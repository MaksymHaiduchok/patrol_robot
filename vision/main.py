import asyncio
import base64
import logging
import os
import threading
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import cv2
import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from annotate import draw_detections, draw_obstacles
from capture import FrameGrabber
from depth import DepthBand, DepthEstimator
from detector import Detection, PersonDetector
from events import EventSender, PresenceTracker
from experiment_log import ExperimentLog
from faces import FaceError, FaceRecognizer, KnownFace, normalize
from snapshots import SnapshotStore, encode_jpeg

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("vision")

STREAM_BOUNDARY = "frame"
STREAM_POLL_SECONDS = 0.01
EMBEDDINGS_RETRY_SECONDS = 5.0
API_URL = os.getenv("API_URL", "http://localhost:4000")

grabber = FrameGrabber(os.getenv("PHONE_STREAM_URL", "0"))
recognizer = FaceRecognizer(threshold=float(os.getenv("FACE_MATCH_THRESHOLD", "0.363")))
detector = PersonDetector(
    source=grabber,
    recognizer=recognizer,
    model_path=os.getenv("YOLO_MODEL", "models/yolo11n.pt"),
    device=os.getenv("YOLO_DEVICE", "mps"),
    confidence=float(os.getenv("PERSON_CONFIDENCE", "0.5")),
    max_fps=float(os.getenv("DETECTION_MAX_FPS", "10")),
)
OBSTACLE_NEAR_RATIO = float(os.getenv("OBSTACLE_NEAR_RATIO", "0.7"))
depth = (
    DepthEstimator(
        source=grabber,
        model_name=os.getenv("DEPTH_MODEL", "depth-anything/Depth-Anything-V2-Small-hf"),
        device=os.getenv("YOLO_DEVICE", "mps"),
        max_fps=float(os.getenv("DEPTH_MAX_FPS", "8")),
        band=DepthBand(
            top=float(os.getenv("DEPTH_BAND_TOP", "0.30")),
            bottom=float(os.getenv("DEPTH_BAND_BOTTOM", "0.60")),
            floor_rows=float(os.getenv("DEPTH_FLOOR_ROWS", "0.12")),
            reference="frame" if os.getenv("DEPTH_REFERENCE", "floor") == "frame" else "floor",
            percentile=float(os.getenv("DEPTH_ZONE_PERCENTILE", "50")),
        ),
    )
    if os.getenv("DEPTH_ENABLED", "1") == "1"
    else None
)


def annotate(frame: np.ndarray) -> None:
    draw_detections(frame, detector.detections())
    if depth is None:
        return
    obstacles = depth.obstacles()
    zones = (obstacles.left, obstacles.center, obstacles.right) if obstacles else None
    draw_obstacles(
        frame, zones, OBSTACLE_NEAR_RATIO, (depth.band.top, depth.band.bottom), depth.preview()
    )


grabber.set_annotator(annotate)
presence = PresenceTracker(cooldown_seconds=float(os.getenv("EVENT_COOLDOWN_SECONDS", "15")))
sender = EventSender(API_URL)
snapshots = SnapshotStore()
experiment = ExperimentLog() if os.getenv("EXPERIMENT_LOG") == "1" else None
stop_loading = threading.Event()
SNAPSHOT_EVENTS = {"person_detected", "stranger_detected"}


def on_detections(
    detections: list[Detection], now: float, frame_id: int, frame: np.ndarray
) -> None:
    if experiment is not None:
        experiment.write(detections, frame_id)
    for event in presence.update(detections, now):
        if event.type in SNAPSHOT_EVENTS:
            snapshots.save(event.ts, frame)
        sender.send(event)


detector.set_listener(on_detections)


def load_known_faces() -> int:
    response = httpx.get(f"{API_URL}/persons/embeddings", timeout=10)
    response.raise_for_status()
    known = [
        KnownFace(item["person_id"], item["name"], normalize(item["embedding"]))
        for item in response.json()
    ]
    recognizer.set_known(known)
    return len(known)


def load_known_faces_until_ready() -> None:
    while not stop_loading.is_set():
        try:
            load_known_faces()
            return
        except httpx.HTTPError as error:
            logger.warning("cannot load face embeddings from api (%s), retrying", error)
            stop_loading.wait(EMBEDDINGS_RETRY_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    grabber.start()
    detector.start()
    if depth is not None:
        depth.start()
    threading.Thread(target=load_known_faces_until_ready, name="faces-loader", daemon=True).start()
    logger.info("vision started, source=%s, device=%s", grabber.source, detector.device)
    yield
    stop_loading.set()
    if depth is not None:
        depth.stop()
    detector.stop()
    grabber.stop()
    sender.close()
    if experiment is not None:
        experiment.close()
    logger.info("vision stopped")


app = FastAPI(title="Patrol Robot Vision", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


async def mjpeg_frames() -> AsyncIterator[bytes]:
    last_id = -1
    while True:
        frame_id, jpeg = grabber.latest()
        if jpeg is None or frame_id == last_id:
            await asyncio.sleep(STREAM_POLL_SECONDS)
            continue
        last_id = frame_id
        yield (
            (
                f"--{STREAM_BOUNDARY}\r\nContent-Type: image/jpeg\r\n"
                f"Content-Length: {len(jpeg)}\r\n\r\n"
            ).encode()
            + jpeg
            + b"\r\n"
        )


@app.get("/stream")
def stream() -> StreamingResponse:
    return StreamingResponse(
        mjpeg_frames(),
        media_type=f"multipart/x-mixed-replace; boundary={STREAM_BOUNDARY}",
    )


@app.get("/snapshot")
def snapshot(ts: int | None = None) -> Response:
    if ts is not None:
        jpeg = snapshots.get(ts)
    else:
        _, frame = grabber.latest_frame()
        jpeg = encode_jpeg(frame) if frame is not None else None
    if jpeg is None:
        raise HTTPException(status_code=404, detail="no_snapshot")
    return Response(content=jpeg, media_type="image/jpeg")


@app.get("/obstacles")
def obstacles() -> dict[str, int | float | bool | dict[str, float | bool]]:
    if depth is None:
        raise HTTPException(status_code=503, detail="depth_disabled")
    current = depth.obstacles()
    if current is None:
        raise HTTPException(status_code=503, detail="no_depth_yet")
    zones = {"left": current.left, "center": current.center, "right": current.right}
    return {
        "ts": current.ts,
        "frame_id": current.frame_id,
        "age_ms": int(time.time() * 1000) - current.ts,
        "near_ratio": OBSTACLE_NEAR_RATIO,
        "zones": {name: round(value, 3) for name, value in zones.items()},
        "near": {name: value >= OBSTACLE_NEAR_RATIO for name, value in zones.items()},
    }


@app.get("/health")
def health() -> dict[str, str | bool | float]:
    return {
        "status": "ok" if grabber.connected else "no_source",
        "source_connected": grabber.connected,
        "fps": round(grabber.fps, 1),
    }


@app.get("/metrics")
def metrics() -> dict[str, str | int | float]:
    return {
        "capture_fps": round(grabber.fps, 1),
        **detector.stats(),
        **(depth.stats() if depth is not None else {}),
        "persons_in_frame": len(detector.detections()),
        "known_faces": recognizer.known_count,
        "device": detector.device,
    }


def embed_or_422(image: np.ndarray) -> list[float]:
    try:
        return recognizer.embed_single(image).tolist()
    except FaceError as error:
        raise HTTPException(status_code=422, detail=error.code) from error


@app.post("/faces/embed")
async def embed_face(request: Request) -> dict[str, list[float]]:
    data = np.frombuffer(await request.body(), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR) if data.size else None
    if image is None:
        raise HTTPException(status_code=400, detail="invalid_image")
    return {"embedding": await asyncio.to_thread(embed_or_422, image)}


@app.post("/faces/capture")
def capture_face() -> dict[str, list[float] | str]:
    _, frame = grabber.latest_frame()
    if frame is None:
        raise HTTPException(status_code=503, detail="no_frame")
    embedding = embed_or_422(frame)
    ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise HTTPException(status_code=500, detail="encode_failed")
    return {"embedding": embedding, "image": base64.b64encode(encoded.tobytes()).decode()}


@app.post("/faces/reload")
def reload_faces() -> dict[str, int]:
    try:
        return {"embeddings": load_known_faces()}
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="api_unavailable") from error

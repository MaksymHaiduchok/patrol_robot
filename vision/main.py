import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from annotate import draw_persons
from capture import FrameGrabber
from detector import PersonBox, PersonDetector
from events import EventSender, PresenceTracker

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("vision")

STREAM_BOUNDARY = "frame"
STREAM_POLL_SECONDS = 0.01

grabber = FrameGrabber(os.getenv("PHONE_STREAM_URL", "0"))
detector = PersonDetector(
    source=grabber,
    model_path=os.getenv("YOLO_MODEL", "models/yolo11n.pt"),
    device=os.getenv("YOLO_DEVICE", "mps"),
    confidence=float(os.getenv("PERSON_CONFIDENCE", "0.5")),
    max_fps=float(os.getenv("DETECTION_MAX_FPS", "10")),
)
grabber.set_annotator(lambda frame: draw_persons(frame, detector.boxes()))
presence = PresenceTracker(cooldown_seconds=float(os.getenv("EVENT_COOLDOWN_SECONDS", "15")))
sender = EventSender(os.getenv("API_URL", "http://localhost:4000"))


def on_detections(boxes: list[PersonBox], now: float) -> None:
    event = presence.update(boxes, now)
    if event is not None:
        sender.send(event)


detector.set_listener(on_detections)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    grabber.start()
    detector.start()
    logger.info("vision started, source=%s, device=%s", grabber.source, detector.device)
    yield
    detector.stop()
    grabber.stop()
    sender.close()
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
        "persons_in_frame": len(detector.boxes()),
        "device": detector.device,
    }

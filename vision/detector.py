import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

import numpy as np
import torch
from ultralytics import YOLO

from faces import NO_FACE, FaceMatch, FaceRecognizer

logger = logging.getLogger("vision.detector")

PERSON_CLASS_ID = 0
STATS_WINDOW_SIZE = 100
IDLE_WAIT_SECONDS = 0.01


@dataclass(frozen=True)
class PersonBox:
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float


@dataclass(frozen=True)
class Detection:
    box: PersonBox
    face: FaceMatch


DetectionListener = Callable[[list[Detection], float, int, np.ndarray], None]


class FrameSource(Protocol):
    def latest_frame(self) -> tuple[int, np.ndarray | None]: ...


def resolve_device(requested: str) -> str:
    if requested == "mps" and not torch.backends.mps.is_available():
        logger.warning("mps is not available, falling back to cpu")
        return "cpu"
    return requested


def average(values: list[float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


class PersonDetector:
    def __init__(
        self,
        source: FrameSource,
        recognizer: FaceRecognizer,
        model_path: str,
        device: str,
        confidence: float,
        max_fps: float,
    ) -> None:
        self._source = source
        self._recognizer = recognizer
        self._model = YOLO(model_path)
        self.device = resolve_device(device)
        self._confidence = confidence
        self._min_interval = 1.0 / max_fps
        self._lock = threading.Lock()
        self._detections: list[Detection] = []
        self._listener: DetectionListener | None = None
        self._inference_ms: deque[float] = deque(maxlen=STATS_WINDOW_SIZE)
        self._face_ms: deque[float] = deque(maxlen=STATS_WINDOW_SIZE)
        self._timestamps: deque[float] = deque(maxlen=STATS_WINDOW_SIZE)
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="person-detector", daemon=True)

    def set_listener(self, listener: DetectionListener) -> None:
        self._listener = listener

    def start(self) -> None:
        self._warm_up()
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def detections(self) -> list[Detection]:
        with self._lock:
            return list(self._detections)

    def stats(self) -> dict[str, float]:
        with self._lock:
            inference = list(self._inference_ms)
            face = list(self._face_ms)
            timestamps = list(self._timestamps)
        elapsed = timestamps[-1] - timestamps[0] if len(timestamps) > 1 else 0.0
        return {
            "detection_fps": round((len(timestamps) - 1) / elapsed, 1) if elapsed > 0 else 0.0,
            "inference_ms_avg": average(inference),
            "inference_ms_max": round(max(inference), 1) if inference else 0.0,
            "face_ms_avg": average(face),
        }

    def _warm_up(self) -> None:
        started = time.perf_counter()
        self._predict(np.zeros((640, 640, 3), dtype=np.uint8))
        logger.info(
            "model ready on %s, warm-up %.0f ms",
            self.device,
            (time.perf_counter() - started) * 1000,
        )

    def _predict(self, frame: np.ndarray) -> list[PersonBox]:
        result = self._model.predict(
            frame,
            classes=[PERSON_CLASS_ID],
            conf=self._confidence,
            device=self.device,
            verbose=False,
        )[0]
        return [
            PersonBox(int(x1), int(y1), int(x2), int(y2), float(confidence))
            for (x1, y1, x2, y2), confidence in zip(
                result.boxes.xyxy.tolist(), result.boxes.conf.tolist(), strict=True
            )
        ]

    def _identify(self, frame: np.ndarray, box: PersonBox) -> FaceMatch:
        crop = np.ascontiguousarray(frame[box.y1 : box.y2, box.x1 : box.x2])
        if crop.size == 0:
            return NO_FACE
        return self._recognizer.identify(crop)

    def _run(self) -> None:
        last_frame_id = -1
        last_summary = ""
        while not self._stop.is_set():
            started = time.monotonic()
            frame_id, frame = self._source.latest_frame()
            if frame is None or frame_id == last_frame_id:
                self._stop.wait(IDLE_WAIT_SECONDS)
                continue
            last_frame_id = frame_id

            inference_started = time.perf_counter()
            boxes = self._predict(frame)
            inference_ms = (time.perf_counter() - inference_started) * 1000

            face_started = time.perf_counter()
            detections = [Detection(box, self._identify(frame, box)) for box in boxes]
            face_ms = (time.perf_counter() - face_started) * 1000

            with self._lock:
                self._detections = detections
                self._inference_ms.append(inference_ms)
                if detections:
                    self._face_ms.append(face_ms)
                self._timestamps.append(time.monotonic())

            if self._listener is not None:
                self._listener(detections, time.monotonic(), frame_id, frame)

            summary = describe(detections)
            if summary != last_summary:
                logger.info("in frame: %s", summary or "nobody")
                last_summary = summary

            self._stop.wait(max(0.0, self._min_interval - (time.monotonic() - started)))


def describe(detections: list[Detection]) -> str:
    labels = []
    for detection in detections:
        if detection.face.name:
            labels.append(detection.face.name)
        elif detection.face.face_found:
            labels.append("stranger")
        else:
            labels.append("person")
    return ", ".join(sorted(labels))

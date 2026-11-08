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


DetectionListener = Callable[[list[PersonBox], float], None]


class FrameSource(Protocol):
    def latest_frame(self) -> tuple[int, np.ndarray | None]: ...


def resolve_device(requested: str) -> str:
    if requested == "mps" and not torch.backends.mps.is_available():
        logger.warning("mps is not available, falling back to cpu")
        return "cpu"
    return requested


class PersonDetector:
    def __init__(
        self,
        source: FrameSource,
        model_path: str,
        device: str,
        confidence: float,
        max_fps: float,
    ) -> None:
        self._source = source
        self._model = YOLO(model_path)
        self.device = resolve_device(device)
        self._confidence = confidence
        self._min_interval = 1.0 / max_fps
        self._lock = threading.Lock()
        self._boxes: list[PersonBox] = []
        self._listener: DetectionListener | None = None
        self._inference_ms: deque[float] = deque(maxlen=STATS_WINDOW_SIZE)
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

    def boxes(self) -> list[PersonBox]:
        with self._lock:
            return list(self._boxes)

    def stats(self) -> dict[str, float]:
        with self._lock:
            inference = list(self._inference_ms)
            timestamps = list(self._timestamps)
        elapsed = timestamps[-1] - timestamps[0] if len(timestamps) > 1 else 0.0
        return {
            "detection_fps": round((len(timestamps) - 1) / elapsed, 1) if elapsed > 0 else 0.0,
            "inference_ms_avg": round(sum(inference) / len(inference), 1) if inference else 0.0,
            "inference_ms_max": round(max(inference), 1) if inference else 0.0,
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

    def _run(self) -> None:
        last_frame_id = -1
        last_count = 0
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

            with self._lock:
                self._boxes = boxes
                self._inference_ms.append(inference_ms)
                self._timestamps.append(time.monotonic())

            if self._listener is not None:
                self._listener(boxes, time.monotonic())

            if len(boxes) != last_count:
                logger.info("persons in frame: %d", len(boxes))
                last_count = len(boxes)

            self._stop.wait(max(0.0, self._min_interval - (time.monotonic() - started)))

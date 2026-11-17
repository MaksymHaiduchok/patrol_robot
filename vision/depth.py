import logging
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np
import torch
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

from detector import FrameSource, resolve_device

logger = logging.getLogger("vision.depth")

INPUT_SIZE = {"height": 252, "width": 448}
STATS_WINDOW_SIZE = 100
IDLE_WAIT_SECONDS = 0.01
ZONES = ("left", "center", "right")


@dataclass(frozen=True)
class DepthBand:
    top: float
    bottom: float
    floor_rows: float
    reference: Literal["floor", "frame"]
    percentile: float


@dataclass(frozen=True)
class Obstacles:
    ts: int
    frame_id: int
    left: float
    center: float
    right: float


class DepthEstimator:
    def __init__(
        self, source: FrameSource, model_name: str, device: str, max_fps: float, band: DepthBand
    ) -> None:
        self._source = source
        self.device = resolve_device(device)
        self._processor = AutoImageProcessor.from_pretrained(model_name)
        self._model = AutoModelForDepthEstimation.from_pretrained(model_name).to(self.device).eval()
        self._band = band
        self._min_interval = 1.0 / max_fps
        self._lock = threading.Lock()
        self._obstacles: Obstacles | None = None
        self._preview: np.ndarray | None = None
        self._depth_ms: deque[float] = deque(maxlen=STATS_WINDOW_SIZE)
        self._timestamps: deque[float] = deque(maxlen=STATS_WINDOW_SIZE)
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="depth-estimator", daemon=True)

    @property
    def band(self) -> DepthBand:
        return self._band

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def obstacles(self) -> Obstacles | None:
        with self._lock:
            return self._obstacles

    def preview(self) -> np.ndarray | None:
        with self._lock:
            return self._preview

    def stats(self) -> dict[str, float]:
        with self._lock:
            depth = list(self._depth_ms)
            timestamps = list(self._timestamps)
        elapsed = timestamps[-1] - timestamps[0] if len(timestamps) > 1 else 0.0
        return {
            "depth_fps": round((len(timestamps) - 1) / elapsed, 1) if elapsed > 0 else 0.0,
            "depth_ms_avg": round(sum(depth) / len(depth), 1) if depth else 0.0,
        }

    def _estimate(self, frame: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        inputs = self._processor(
            images=rgb, return_tensors="pt", size=INPUT_SIZE, keep_aspect_ratio=False
        ).to(self.device)
        with torch.no_grad():
            depth = self._model(**inputs).predicted_depth[0]
        return depth.float().cpu().numpy()

    def _zones(self, disparity: np.ndarray) -> tuple[float, float, float]:
        height = disparity.shape[0]
        if self._band.reference == "frame":
            reference = float(np.median(disparity)) or 1e-6
        else:
            floor = disparity[int(height * (1 - self._band.floor_rows)) :, :]
            reference = float(np.median(floor)) or 1e-6
        band = disparity[int(height * self._band.top) : int(height * self._band.bottom), :]
        thirds = np.array_split(band, 3, axis=1)
        values = [float(np.percentile(zone, self._band.percentile)) / reference for zone in thirds]
        return values[0], values[1], values[2]

    def _run(self) -> None:
        last_frame_id = -1
        while not self._stop.is_set():
            started = time.monotonic()
            frame_id, frame = self._source.latest_frame()
            if frame is None or frame_id == last_frame_id:
                self._stop.wait(IDLE_WAIT_SECONDS)
                continue
            last_frame_id = frame_id

            estimate_started = time.perf_counter()
            disparity = self._estimate(frame)
            depth_ms = (time.perf_counter() - estimate_started) * 1000
            left, center, right = self._zones(disparity)
            obstacles = Obstacles(int(time.time() * 1000), frame_id, left, center, right)
            preview = colorize(disparity)

            with self._lock:
                self._obstacles = obstacles
                self._preview = preview
                self._depth_ms.append(depth_ms)
                self._timestamps.append(time.monotonic())

            self._stop.wait(max(0.0, self._min_interval - (time.monotonic() - started)))


def colorize(disparity: np.ndarray) -> np.ndarray:
    low, high = np.percentile(disparity, [2, 98])
    scaled = np.clip((disparity - low) / max(high - low, 1e-6), 0, 1)
    return cv2.applyColorMap((scaled * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)

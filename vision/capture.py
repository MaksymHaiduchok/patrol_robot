import logging
import threading
import time
from collections import deque
from collections.abc import Callable

import cv2
import numpy as np

logger = logging.getLogger("vision.capture")

RECONNECT_DELAY_SECONDS = 2.0
JPEG_QUALITY = 80
FPS_WINDOW_SIZE = 30

Annotator = Callable[[np.ndarray], None]


def parse_source(source: str) -> int | str:
    return int(source) if source.isdigit() else source


class FrameGrabber:
    def __init__(self, source: str) -> None:
        self.source = parse_source(source)
        self._annotator: Annotator | None = None
        self._lock = threading.Lock()
        self._frame: np.ndarray | None = None
        self._jpeg: bytes | None = None
        self._frame_id = 0
        self._connected = False
        self._timestamps: deque[float] = deque(maxlen=FPS_WINDOW_SIZE)
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="frame-grabber", daemon=True)

    def set_annotator(self, annotator: Annotator) -> None:
        self._annotator = annotator

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def latest(self) -> tuple[int, bytes | None]:
        with self._lock:
            return self._frame_id, self._jpeg

    def latest_frame(self) -> tuple[int, np.ndarray | None]:
        with self._lock:
            return self._frame_id, self._frame

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def fps(self) -> float:
        with self._lock:
            if len(self._timestamps) < 2:
                return 0.0
            elapsed = self._timestamps[-1] - self._timestamps[0]
            return (len(self._timestamps) - 1) / elapsed if elapsed > 0 else 0.0

    def _run(self) -> None:
        while not self._stop.is_set():
            capture = cv2.VideoCapture(self.source)
            if not capture.isOpened():
                logger.warning("cannot open source %s, retrying", self.source)
                capture.release()
                self._stop.wait(RECONNECT_DELAY_SECONDS)
                continue

            logger.info("connected to source %s", self.source)
            self._connected = True
            self._read_frames(capture)
            self._connected = False
            capture.release()
            logger.warning("lost source %s, reconnecting", self.source)

    def _read_frames(self, capture: cv2.VideoCapture) -> None:
        while not self._stop.is_set():
            ok, frame = capture.read()
            if not ok:
                return

            annotated = frame.copy()
            if self._annotator is not None:
                self._annotator(annotated)

            ok, encoded = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            if not ok:
                continue

            with self._lock:
                self._frame = frame
                self._jpeg = encoded.tobytes()
                self._frame_id += 1
                self._timestamps.append(time.monotonic())

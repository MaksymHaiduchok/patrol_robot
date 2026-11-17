import threading
from collections import OrderedDict

import cv2
import numpy as np

JPEG_QUALITY = 85
MAX_SNAPSHOTS = 20


def encode_jpeg(frame: np.ndarray) -> bytes | None:
    ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    return encoded.tobytes() if ok else None


class SnapshotStore:
    def __init__(self, max_items: int = MAX_SNAPSHOTS) -> None:
        self._max_items = max_items
        self._lock = threading.Lock()
        self._items: OrderedDict[int, bytes] = OrderedDict()

    def save(self, ts: int, frame: np.ndarray) -> None:
        jpeg = encode_jpeg(frame)
        if jpeg is None:
            return
        with self._lock:
            self._items[ts] = jpeg
            while len(self._items) > self._max_items:
                self._items.popitem(last=False)

    def get(self, ts: int) -> bytes | None:
        with self._lock:
            return self._items.get(ts)

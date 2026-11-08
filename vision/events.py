import logging
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Literal

import httpx

from detector import PersonBox

logger = logging.getLogger("vision.events")

EventType = Literal["person_detected", "known_person", "stranger_detected", "person_left"]

LEFT_AFTER_SECONDS = 3.0
REQUEST_TIMEOUT_SECONDS = 5.0


@dataclass(frozen=True)
class VisionEvent:
    type: EventType
    confidence: float | None
    ts: int


class PresenceTracker:
    def __init__(self, cooldown_seconds: float, left_after_seconds: float = LEFT_AFTER_SECONDS):
        self._cooldown = cooldown_seconds
        self._left_after = left_after_seconds
        self._visit_open = False
        self._last_seen: float | None = None
        self._last_left: float | None = None

    def update(self, boxes: list[PersonBox], now: float) -> VisionEvent | None:
        if boxes:
            self._last_seen = now
            if not self._visit_open and self._cooldown_passed(now):
                self._visit_open = True
                confidence = max(box.confidence for box in boxes)
                return VisionEvent("person_detected", round(confidence, 3), _now_ms())
            return None

        if (
            self._visit_open
            and self._last_seen is not None
            and now - self._last_seen >= self._left_after
        ):
            self._visit_open = False
            self._last_left = now
            return VisionEvent("person_left", None, _now_ms())
        return None

    def _cooldown_passed(self, now: float) -> bool:
        return self._last_left is None or now - self._last_left >= self._cooldown


class EventSender:
    def __init__(self, api_url: str) -> None:
        self._client = httpx.Client(base_url=api_url, timeout=REQUEST_TIMEOUT_SECONDS)
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="event-sender")

    def send(self, event: VisionEvent) -> None:
        logger.info("event %s confidence=%s", event.type, event.confidence)
        self._executor.submit(self._post, event)

    def close(self) -> None:
        self._executor.shutdown(wait=True)
        self._client.close()

    def _post(self, event: VisionEvent) -> None:
        started = time.perf_counter()
        try:
            response = self._client.post(
                "/events",
                json={"type": event.type, "confidence": event.confidence, "ts": event.ts},
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            logger.error("failed to send %s: %s", event.type, error)
            return
        logger.info("sent %s to api in %.0f ms", event.type, (time.perf_counter() - started) * 1000)


def _now_ms() -> int:
    return int(time.time() * 1000)

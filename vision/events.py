import logging
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Literal

import httpx

from detector import Detection

logger = logging.getLogger("vision.events")

EventType = Literal["person_detected", "known_person", "stranger_detected", "person_left"]

LEFT_AFTER_SECONDS = 3.0
STRANGER_CONFIRM_FRAMES = 5
KNOWN_GRACE_SECONDS = 3.0
REQUEST_TIMEOUT_SECONDS = 5.0
STRANGER_KEY = "stranger"


@dataclass(frozen=True)
class VisionEvent:
    type: EventType
    confidence: float | None
    ts: int
    person_id: str | None = None


class PresenceTracker:
    def __init__(self, cooldown_seconds: float, left_after_seconds: float = LEFT_AFTER_SECONDS):
        self._cooldown = cooldown_seconds
        self._left_after = left_after_seconds
        self._visit_open = False
        self._last_seen: float | None = None
        self._last_left: float | None = None
        self._identity_last_seen: dict[str, float] = {}
        self._stranger_streak = 0
        self._last_known_at: float | None = None

    def update(self, detections: list[Detection], now: float) -> list[VisionEvent]:
        events: list[VisionEvent] = []
        presence = self._update_presence(detections, now)
        if presence is not None:
            events.append(presence)
        events.extend(self._update_known(detections, now))
        stranger = self._update_stranger(detections, now)
        if stranger is not None:
            events.append(stranger)
        return events

    def _update_presence(self, detections: list[Detection], now: float) -> VisionEvent | None:
        if detections:
            self._last_seen = now
            if not self._visit_open and self._cooldown_passed(now):
                self._visit_open = True
                confidence = max(detection.box.confidence for detection in detections)
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

    def _update_known(self, detections: list[Detection], now: float) -> list[VisionEvent]:
        events: list[VisionEvent] = []
        for detection in detections:
            person_id = detection.face.person_id
            if person_id is None:
                continue
            self._last_known_at = now
            if self._identity_appeared(person_id, now):
                events.append(
                    VisionEvent(
                        "known_person", round(detection.face.score, 3), _now_ms(), person_id
                    )
                )
        return events

    def _update_stranger(self, detections: list[Detection], now: float) -> VisionEvent | None:
        strangers = [
            detection
            for detection in detections
            if detection.face.face_found and detection.face.person_id is None
        ]
        if not strangers or self._is_known_turning_away(detections, now):
            self._stranger_streak = 0
            return None

        self._stranger_streak += 1
        if self._stranger_streak < STRANGER_CONFIRM_FRAMES:
            return None
        if not self._identity_appeared(STRANGER_KEY, now):
            return None
        confidence = max(detection.box.confidence for detection in strangers)
        return VisionEvent("stranger_detected", round(confidence, 3), _now_ms())

    def _is_known_turning_away(self, detections: list[Detection], now: float) -> bool:
        return (
            len(detections) == 1
            and self._last_known_at is not None
            and now - self._last_known_at < KNOWN_GRACE_SECONDS
        )

    def _identity_appeared(self, key: str, now: float) -> bool:
        last_seen = self._identity_last_seen.get(key)
        self._identity_last_seen[key] = now
        return last_seen is None or now - last_seen >= self._cooldown

    def _cooldown_passed(self, now: float) -> bool:
        return self._last_left is None or now - self._last_left >= self._cooldown


class EventSender:
    def __init__(self, api_url: str) -> None:
        self._client = httpx.Client(base_url=api_url, timeout=REQUEST_TIMEOUT_SECONDS)
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="event-sender")

    def send(self, event: VisionEvent) -> None:
        logger.info(
            "event %s confidence=%s person_id=%s", event.type, event.confidence, event.person_id
        )
        self._executor.submit(self._post, event)

    def close(self) -> None:
        self._executor.shutdown(wait=True)
        self._client.close()

    def _post(self, event: VisionEvent) -> None:
        started = time.perf_counter()
        try:
            response = self._client.post(
                "/events",
                json={
                    "type": event.type,
                    "confidence": event.confidence,
                    "person_id": event.person_id,
                    "ts": event.ts,
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            logger.error("failed to send %s: %s", event.type, error)
            return
        logger.info("sent %s to api in %.0f ms", event.type, (time.perf_counter() - started) * 1000)


def _now_ms() -> int:
    return int(time.time() * 1000)

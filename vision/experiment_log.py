import csv
import logging
import time
from datetime import datetime
from pathlib import Path

from detector import Detection

logger = logging.getLogger("vision.experiment")

LOGS_DIR = Path(__file__).resolve().parent / "logs"
COLUMNS = [
    "ts",
    "frame_id",
    "person_conf",
    "box_h_px",
    "face_found",
    "best_person",
    "best_score",
    "decision",
]


def decision(detection: Detection) -> str:
    if not detection.face.face_found:
        return "no_face"
    return "known" if detection.face.person_id else "stranger"


class ExperimentLog:
    def __init__(self) -> None:
        LOGS_DIR.mkdir(exist_ok=True)
        self.path = LOGS_DIR / f"faces-{datetime.now():%Y%m%d-%H%M}.csv"
        self._file = self.path.open("w", newline="", encoding="utf-8")
        self._writer = csv.writer(self._file)
        self._writer.writerow(COLUMNS)
        logger.info("experiment log: %s", self.path)

    def write(self, detections: list[Detection], frame_id: int) -> None:
        ts = int(time.time() * 1000)
        for detection in detections:
            face = detection.face
            self._writer.writerow(
                [
                    ts,
                    frame_id,
                    round(detection.box.confidence, 3),
                    detection.box.y2 - detection.box.y1,
                    int(face.face_found),
                    face.best_name or "",
                    round(face.score, 4) if face.face_found else "",
                    decision(detection),
                ]
            )
        if detections:
            self._file.flush()

    def close(self) -> None:
        self._file.close()

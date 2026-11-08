import cv2
import numpy as np

from detector import PersonBox

PERSON_COLOR = (0, 200, 0)
FONT = cv2.FONT_HERSHEY_SIMPLEX


def draw_persons(frame: np.ndarray, boxes: list[PersonBox]) -> None:
    for box in boxes:
        cv2.rectangle(frame, (box.x1, box.y1), (box.x2, box.y2), PERSON_COLOR, 2)
        label = f"person {box.confidence:.2f}"
        (text_width, text_height), baseline = cv2.getTextSize(label, FONT, 0.6, 2)
        top = max(box.y1 - text_height - baseline - 4, 0)
        cv2.rectangle(
            frame,
            (box.x1, top),
            (box.x1 + text_width + 6, top + text_height + baseline + 4),
            PERSON_COLOR,
            cv2.FILLED,
        )
        cv2.putText(frame, label, (box.x1 + 3, top + text_height + 2), FONT, 0.6, (0, 0, 0), 2)

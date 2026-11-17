from functools import lru_cache

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from detector import Detection

FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
PERSON_COLOR = (0, 200, 0)
KNOWN_COLOR = (230, 130, 0)
STRANGER_COLOR = (40, 40, 230)
TEXT_COLOR = (255, 255, 255)
LABEL_PADDING = 6


def label_for(detection: Detection) -> tuple[str, tuple[int, int, int]]:
    face = detection.face
    if face.name:
        return f"{face.name} {face.score:.2f}", KNOWN_COLOR
    if face.face_found:
        return f"Чужий {face.score:.2f}", STRANGER_COLOR
    return f"Людина {detection.box.confidence:.2f}", PERSON_COLOR


@lru_cache(maxsize=8)
def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default(size)


@lru_cache(maxsize=256)
def render_label(text: str, color: tuple[int, int, int], size: int) -> np.ndarray:
    font = load_font(size)
    left, top, right, bottom = font.getbbox(text)
    width = right - left + LABEL_PADDING * 2
    height = bottom - top + LABEL_PADDING * 2
    rgb_background = (color[2], color[1], color[0])
    image = Image.new("RGB", (width, height), rgb_background)
    ImageDraw.Draw(image).text((LABEL_PADDING - left, LABEL_PADDING - top), text, TEXT_COLOR, font)
    return cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)


def paste_label(frame: np.ndarray, label: np.ndarray, x: int, y: int) -> None:
    frame_height, frame_width = frame.shape[:2]
    label_height, label_width = label.shape[:2]
    top = min(max(y - label_height, 0), frame_height - label_height)
    left = min(max(x, 0), max(frame_width - label_width, 0))
    visible_width = min(label_width, frame_width - left)
    frame[top : top + label_height, left : left + visible_width] = label[:, :visible_width]


def draw_detections(frame: np.ndarray, detections: list[Detection]) -> None:
    frame_width = frame.shape[1]
    font_size = max(14, frame_width // 50)
    thickness = max(2, frame_width // 500)
    for detection in detections:
        box = detection.box
        text, color = label_for(detection)
        cv2.rectangle(frame, (box.x1, box.y1), (box.x2, box.y2), color, thickness)
        paste_label(frame, render_label(text, color, font_size), box.x1, box.y1)


NEAR_COLOR = (40, 40, 230)
FREE_COLOR = (0, 200, 0)
BAND_COLOR = (200, 200, 200)
PREVIEW_SCALE = 0.25


def draw_obstacles(
    frame: np.ndarray,
    zones: tuple[float, float, float] | None,
    near_ratio: float,
    band: tuple[float, float],
    preview: np.ndarray | None,
) -> None:
    height, width = frame.shape[:2]
    top, bottom = int(height * band[0]), int(height * band[1])
    for x in (width // 3, width * 2 // 3):
        cv2.line(frame, (x, top), (x, bottom), BAND_COLOR, 1)
    cv2.line(frame, (0, top), (width, top), BAND_COLOR, 1)
    cv2.line(frame, (0, bottom), (width, bottom), BAND_COLOR, 1)

    if zones is not None:
        font_size = max(14, width // 50)
        for index, value in enumerate(zones):
            color = NEAR_COLOR if value >= near_ratio else FREE_COLOR
            label = render_label(f"{value:.2f}", color, font_size)
            x = width * index // 3 + (width // 3 - label.shape[1]) // 2
            paste_label(frame, label, x, bottom)

    if preview is not None:
        preview_width = int(width * PREVIEW_SCALE)
        preview_height = int(preview.shape[0] * preview_width / preview.shape[1])
        small = cv2.resize(preview, (preview_width, preview_height))
        frame[height - preview_height : height, width - preview_width : width] = small

import logging
import threading
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger("vision.faces")

MODELS_DIR = Path(__file__).resolve().parent / "models"
YUNET_PATH = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
SFACE_PATH = MODELS_DIR / "face_recognition_sface_2021dec.onnx"
FACE_SCORE_THRESHOLD = 0.8
MAX_SEARCH_SIDE = 640


class FaceError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class KnownFace:
    person_id: str
    name: str
    embedding: np.ndarray


@dataclass(frozen=True)
class FaceMatch:
    face_found: bool
    person_id: str | None
    name: str | None
    score: float
    best_name: str | None = None


NO_FACE = FaceMatch(face_found=False, person_id=None, name=None, score=0.0)


class FaceRecognizer:
    def __init__(self, threshold: float) -> None:
        self.threshold = threshold
        self._detector = cv2.FaceDetectorYN.create(
            str(YUNET_PATH), "", (320, 320), FACE_SCORE_THRESHOLD
        )
        self._recognizer = cv2.FaceRecognizerSF.create(str(SFACE_PATH), "")
        self._model_lock = threading.Lock()
        self._known_lock = threading.Lock()
        self._known: list[KnownFace] = []

    @property
    def known_count(self) -> int:
        with self._known_lock:
            return len(self._known)

    def set_known(self, known: list[KnownFace]) -> None:
        with self._known_lock:
            self._known = known
        logger.info(
            "loaded %d face embeddings for %d persons",
            len(known),
            len({face.person_id for face in known}),
        )

    def embed_single(self, image: np.ndarray) -> np.ndarray:
        with self._model_lock:
            faces = self._detect(image)
            if len(faces) == 0:
                raise FaceError("no_face")
            if len(faces) > 1:
                raise FaceError("multiple_faces")
            return self._embed(image, faces[0])

    def identify(self, image: np.ndarray) -> FaceMatch:
        image = downscale(image)
        with self._model_lock:
            faces = self._detect(image)
            if len(faces) == 0:
                return NO_FACE
            largest = max(faces, key=lambda face: face[2] * face[3])
            embedding = self._embed(image, largest)
        return self._match(embedding)

    def _detect(self, image: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        self._detector.setInputSize((width, height))
        _, faces = self._detector.detect(image)
        return faces if faces is not None else np.empty((0, 15), dtype=np.float32)

    def _embed(self, image: np.ndarray, face: np.ndarray) -> np.ndarray:
        aligned = self._recognizer.alignCrop(image, face)
        feature = self._recognizer.feature(aligned).flatten()
        return feature / np.linalg.norm(feature)

    def _match(self, embedding: np.ndarray) -> FaceMatch:
        with self._known_lock:
            known = self._known
        best: KnownFace | None = None
        best_score = -1.0
        for face in known:
            score = float(np.dot(embedding, face.embedding))
            if score > best_score:
                best, best_score = face, score
        if best is None or best_score < self.threshold:
            return FaceMatch(
                face_found=True,
                person_id=None,
                name=None,
                score=max(best_score, 0.0),
                best_name=best.name if best else None,
            )
        return FaceMatch(
            face_found=True,
            person_id=best.person_id,
            name=best.name,
            score=best_score,
            best_name=best.name,
        )


def downscale(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    scale = MAX_SEARCH_SIDE / max(height, width)
    if scale >= 1:
        return image
    return cv2.resize(
        image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA
    )


def normalize(vector: list[float]) -> np.ndarray:
    array = np.asarray(vector, dtype=np.float32)
    return array / np.linalg.norm(array)

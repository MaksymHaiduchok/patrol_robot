import argparse
from pathlib import Path

import cv2
import numpy as np

VISION_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = VISION_DIR / "models"
FACES_DIR = VISION_DIR / "faces_demo"
YUNET_PATH = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
SFACE_PATH = MODELS_DIR / "face_recognition_sface_2021dec.onnx"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

KNOWN_COLOR = (0, 200, 0)
STRANGER_COLOR = (0, 0, 230)

detector = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (320, 320), 0.8)
recognizer = cv2.FaceRecognizerSF.create(str(SFACE_PATH), "")


def detect_faces(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    detector.setInputSize((width, height))
    _, faces = detector.detect(image)
    return faces if faces is not None else np.empty((0, 15))


def embed(image: np.ndarray, face: np.ndarray) -> np.ndarray:
    aligned = recognizer.alignCrop(image, face)
    return recognizer.feature(aligned)


def load_known_faces() -> dict[str, list[np.ndarray]]:
    known: dict[str, list[np.ndarray]] = {}
    for person_dir in sorted(path for path in FACES_DIR.iterdir() if path.is_dir()):
        for photo in sorted(person_dir.iterdir()):
            if photo.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            image = cv2.imread(str(photo))
            if image is None:
                print(f"  {photo.name}: не вдалося прочитати")
                continue
            faces = detect_faces(image)
            if len(faces) != 1:
                print(f"  {photo.name}: знайдено облич {len(faces)}, потрібно рівно 1 — пропускаю")
                continue
            known.setdefault(person_dir.name, []).append(embed(image, faces[0]))
            print(f"  {person_dir.name}: {photo.name} ok")
    return known


def best_match(feature: np.ndarray, known: dict[str, list[np.ndarray]]) -> tuple[str | None, float]:
    best_name: str | None = None
    best_score = -1.0
    for name, features in known.items():
        for candidate in features:
            score = recognizer.match(feature, candidate, cv2.FaceRecognizerSF_FR_COSINE)
            if score > best_score:
                best_name, best_score = name, score
    return best_name, best_score


def main() -> None:
    parser = argparse.ArgumentParser(description="Тест розпізнавання облич: свій/чужий з камери")
    parser.add_argument("--camera", type=int, default=0, help="індекс камери (як PHONE_STREAM_URL)")
    parser.add_argument("--threshold", type=float, default=0.363, help="поріг cosine similarity")
    args = parser.parse_args()

    print(f"Завантажую фото з {FACES_DIR}")
    known = load_known_faces()
    if not known:
        print("Немає жодного обличчя. Поклади фото в faces_demo/<Ім'я>/photo.jpg")
        return
    print(f"Відомі: {', '.join(f'{name} ({len(items)} фото)' for name, items in known.items())}")
    print("Вихід — клавіша q")

    capture = cv2.VideoCapture(args.camera)
    while True:
        ok, frame = capture.read()
        if not ok:
            print("Камера не віддає кадри")
            break

        for face in detect_faces(frame):
            name, score = best_match(embed(frame, face), known)
            is_known = name is not None and score >= args.threshold
            color = KNOWN_COLOR if is_known else STRANGER_COLOR
            label = f"{name} {score:.2f}" if is_known else f"chuzhyi {score:.2f}"
            x, y, w, h = face[:4].astype(int)
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
            cv2.putText(frame, label, (x, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        cv2.imshow("face demo", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

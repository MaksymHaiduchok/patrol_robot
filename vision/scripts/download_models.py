import logging
import urllib.request
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("download_models")

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
ZOO_URL = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models"
MODELS = {
    "yolo11n.pt": "https://huggingface.co/Ultralytics/YOLO11/resolve/main/yolo11n.pt",
    "face_detection_yunet_2023mar.onnx": f"{ZOO_URL}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "face_recognition_sface_2021dec.onnx": f"{ZOO_URL}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}


def main() -> None:
    MODELS_DIR.mkdir(exist_ok=True)
    for name, url in MODELS.items():
        target = MODELS_DIR / name
        if target.exists():
            logger.info("%s already exists", name)
            continue
        logger.info("downloading %s", name)
        urllib.request.urlretrieve(url, target)
        logger.info("saved %s (%.1f MB)", target, target.stat().st_size / 1_000_000)


if __name__ == "__main__":
    main()

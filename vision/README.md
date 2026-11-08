# vision

Сервіс комп'ютерного зору: читає відео з телефону, детектує людей і обличчя, шле події в api. FastAPI + OpenCV + Ultralytics.

## Встановлення і запуск

```bash
cp .env.example .env
uv sync
uv run python scripts/download_models.py
uv run uvicorn main:app --reload --port 8001 --timeout-graceful-shutdown 1
```

Перевірка: http://localhost:8001/health (стан і FPS), http://localhost:8001/stream (відео з рамками), http://localhost:8001/metrics (FPS детекції, час інференсу YOLO).

При першому запуску з камерою Mac macOS спитає дозвіл на камеру для терміналу. Якщо поруч iPhone з Continuity Camera, він може зайняти індекс `0`, а вбудована камера стане `1`.

Форматування і лінтер: `uv run ruff format . && uv run ruff check .`

## Змінні середовища

| Змінна | Опис |
|---|---|
| `PHONE_STREAM_URL` | джерело відео: `0` — камера Mac, `http://<PHONE_IP>:8080/video` — IP Webcam на телефоні |
| `API_URL` | адреса api |
| `YOLO_MODEL` | файл моделі YOLO |
| `YOLO_DEVICE` | `mps` або `cpu` |
| `PERSON_CONFIDENCE` | поріг впевненості детекції людини |
| `DETECTION_MAX_FPS` | максимальна частота запуску YOLO (раз на секунду) |
| `FACE_MATCH_THRESHOLD` | поріг cosine similarity для SFace |
| `EVENT_COOLDOWN_SECONDS` | антидребезг подій |
| `CORS_ORIGINS` | дозволені origin-и для браузера (через кому) |

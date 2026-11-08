# vision

Сервіс комп'ютерного зору: читає відео з телефону, детектує людей і обличчя, шле події в api. FastAPI + OpenCV + Ultralytics.

## Встановлення і запуск

```bash
cp .env.example .env
uv sync
uv run uvicorn main:app --reload --port 8001
```

Перевірка: http://localhost:8001/health.

Форматування і лінтер: `uv run ruff format . && uv run ruff check .`

## Змінні середовища

| Змінна | Опис |
|---|---|
| `PHONE_STREAM_URL` | MJPEG-стрім IP Webcam на телефоні |
| `API_URL` | адреса api |
| `YOLO_MODEL` | файл моделі YOLO |
| `YOLO_DEVICE` | `mps` або `cpu` |
| `PERSON_CONFIDENCE` | поріг впевненості детекції людини |
| `FACE_MATCH_THRESHOLD` | поріг cosine similarity для SFace |
| `EVENT_COOLDOWN_SECONDS` | антидребезг подій |

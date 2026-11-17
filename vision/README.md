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

`GET /obstacles` — оцінка перешкод камерою для вільного патрулювання: зони ліво / центр / право й `near` для кожної (формат у `docs/protocol.md`). На `/stream` видно смугу пошуку, значення зон (червоне — зайнято) і мініатюру карти глибини в правому нижньому куті.

`GET /snapshot?ts=<ts події>` — сирий кадр, на якому сформовано подію `person_detected` / `stranger_detected` (vision тримає 20 останніх); без `ts` — останній кадр з камери. Викликає api для знімків у журналі.

Ендпоінти облич (викликає api): `POST /faces/embed` (тіло — байти зображення), `POST /faces/capture` (обличчя з поточного кадру), `POST /faces/reload` (перечитати «своїх» з api). Вектори «своїх» vision бере з `GET {API_URL}/persons/embeddings` при старті.

При першому запуску з камерою Mac macOS спитає дозвіл на камеру для терміналу. Якщо поруч iPhone з Continuity Camera, він може зайняти індекс `0`, а вбудована камера стане `1`.

## Заміри

- `EXPERIMENT_LOG=1` у `.env` → CSV `logs/faces-YYYYMMDD-HHMM.csv`: рядок на кожну людину в кожному циклі детекції (`ts, frame_id, person_conf, box_h_px, face_found, best_person, best_score, decision`).
- `uv run python scripts/measure_metrics.py --seconds 120 --label mps` — опитує `/metrics` раз на секунду, пише `logs/metrics-*.csv` і друкує середнє/макс.
- `uv run python scripts/far_frr.py logs/faces-….csv who.csv` — FAR/FRR для порогів 0.30 / 0.363 / 0.40 / 0.45 і частка знайдених облич за висотою рамки. `who.csv` — розмітка вручну: `start_ts,end_ts,person_name`, де `person_name` — ім'я «свого» як у базі або `stranger`.

Шаблон таблиць — `docs/metrics.md`. Папка `logs/` у `.gitignore`.

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
| `EXPERIMENT_LOG` | `1` — писати CSV для замірів точності |
| `DEPTH_ENABLED` | `1` — оцінка глибини для вільного патрулювання |
| `DEPTH_MODEL` | модель глибини (`depth-anything/Depth-Anything-V2-Small-hf`, ~100 МБ, завантажується при першому запуску) |
| `DEPTH_MAX_FPS` | максимальна частота оцінки глибини |
| `DEPTH_BAND_TOP`, `DEPTH_BAND_BOTTOM` | смуга кадру (частки висоти), де шукаються перешкоди |
| `DEPTH_REFERENCE` | з чим порівнювати зону: `floor` — з підлогою в нижніх `DEPTH_FLOOR_ROWS` кадру (телефон дивиться трохи вниз), `frame` — з медіаною всього кадру (смуга внизу кадру) |
| `DEPTH_FLOOR_ROWS` | частка кадру знизу — підлога для нормування (лише `DEPTH_REFERENCE=floor`) |
| `OBSTACLE_NEAR_RATIO` | поріг «зайнято»: близькість зони / близькість підлоги |

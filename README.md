# Patrol Robot

Магістерська робота «Система керування мобільним роботом на основі комп'ютерного зору».
Повна специфікація — [CLAUDE.md](CLAUDE.md).

## Сервіси

| Папка | Що це | Порт |
|---|---|---|
| [web](web/README.md) | Панель оператора (Next.js) | 3000 |
| [api](api/README.md) | Диспетчер подій і команд (NestJS) | 4000 |
| [vision](vision/README.md) | Комп'ютерний зір (FastAPI, OpenCV, YOLO) | 8001 |
| [robot-bridge](robot-bridge/README.md) | Міст api ↔ LEGO Technic Hub (42160) по Bluetooth LE (Node.js) | — |
| [fake-robot](fake-robot/README.md) | Імітатор робота для розробки без заліза | — |

## Потрібно встановити

- Node.js 20+ і pnpm (`brew install pnpm`)
- uv (`brew install uv`) — сам поставить Python 3.12 для vision

## Локальний запуск

Кожен сервіс запускається окремо, у своєму терміналі. Перед першим запуском скопіюй `.env.example` → `.env` (для web → `.env.local`).

```bash
cd vision && uv sync && uv run python scripts/download_models.py && uv run uvicorn main:app --reload --port 8001 --timeout-graceful-shutdown 1
cd api && pnpm install && pnpm start:dev
cd web && pnpm install && pnpm dev
cd robot-bridge && pnpm install && pnpm start
```

Перший запуск:

1. Supabase: застосувати всі міграції з `api/supabase/migrations/` по порядку (SQL Editor, див. [api/README.md](api/README.md)).
2. `api/.env`: ключі Supabase, `ANTHROPIC_API_KEY` (для описів чужих; без ключа все інше працює).
3. Телефон: IP Webcam → `vision/.env` `PHONE_STREAM_URL=http://<PHONE_IP>:8080/video`.
4. LEGO: увімкнути хаб, `cd robot-bridge && pnpm probe` — перевірити, що мотори на A, B, D.

Для `robot-bridge` хаб має бути увімкнений, а передні колеса виставлені прямо. Порти хаба перевіряє `pnpm probe`. Папка `robot/` (Raspberry Pi + Freenove) — відкинутий варіант, див. [docs/decisions.md](docs/decisions.md).

Перевірка: http://localhost:8001/health, http://localhost:4000, http://localhost:3000.

Сценарій демо: «Ручне» → «Зафіксувати» дім → проїхати маршрут стрілками → «Авто» — машинка їздить маршрутом туди-назад, зупиняється, коли в кадрі людина, їде далі, якщо це «свій» або через 30 с після того, як людина пішла; чужого фотографує, і Claude описує сцену. «Стаціонар» — телефон знятий, система лише спостерігає.

## Документація

- [docs/protocol.md](docs/protocol.md) — протокол повідомлень між сервісами
- [docs/decisions.md](docs/decisions.md) — журнал архітектурних рішень
- [docs/metrics.md](docs/metrics.md) — результати замірів

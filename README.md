# Patrol Robot

Магістерська робота «Система керування мобільним роботом на основі комп'ютерного зору».
Повна специфікація — [CLAUDE.md](CLAUDE.md).

## Сервіси

| Папка | Що це | Порт |
|---|---|---|
| [web](web/README.md) | Панель оператора (Next.js) | 3000 |
| [api](api/README.md) | Диспетчер подій і команд (NestJS) | 4000 |
| [vision](vision/README.md) | Комп'ютерний зір (FastAPI, OpenCV, YOLO) | 8001 |
| [robot](robot/README.md) | Бортовий код для Raspberry Pi Zero 2W | — |
| [fake-robot](fake-robot/README.md) | Імітатор робота для розробки без заліза | — |

## Потрібно встановити

- Node.js 20+ і pnpm (`brew install pnpm`)
- uv (`brew install uv`) — сам поставить Python 3.12 для vision

## Локальний запуск

Кожен сервіс запускається окремо, у своєму терміналі. Перед першим запуском скопіюй `.env.example` → `.env` (для web → `.env.local`).

```bash
cd vision && uv sync && uv run uvicorn main:app --reload --port 8001
cd api && pnpm install && pnpm start:dev
cd web && pnpm install && pnpm dev
```

Перевірка: http://localhost:8001/health, http://localhost:4000, http://localhost:3000.

## Документація

- [docs/protocol.md](docs/protocol.md) — протокол повідомлень між сервісами
- [docs/decisions.md](docs/decisions.md) — журнал архітектурних рішень
- [docs/metrics.md](docs/metrics.md) — результати замірів

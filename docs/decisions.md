# Журнал архітектурних рішень

## Етап 0 — скелет репозиторію (2026-11-08)

- Звичайний репозиторій з окремими папками без workspaces/Turborepo: кожен сервіс незалежний і запускається окремо, що відповідає модульній архітектурі (будь-який модуль можна замінити).
- web згенеровано `create-next-app` (Next.js 16, App Router, TypeScript, Tailwind 4), api — `@nestjs/cli` (NestJS 12, ESM, strict, Vitest), vision — `uv` (Python 3.12, FastAPI).
- vision має плоску структуру з `main.py` у корені, щоб запускатися як `uvicorn main:app`.
- api слухає порт 4000 за замовчуванням і має увімкнений CORS для web.
- robot і fake-robot поки лише з README і `.env.example`: їхній код — етапи 7–8.
- Секрети тільки в `.env` (у `.gitignore`), у репозиторії — `.env.example`.

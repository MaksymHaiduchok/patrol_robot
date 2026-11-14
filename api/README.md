# api

Диспетчер: приймає події від vision, керує роботом, працює з Supabase і Claude API. NestJS + TypeScript.

## Встановлення і запуск

```bash
cp .env.example .env
pnpm install
pnpm start:dev
```

Сервер слухає http://localhost:4000.

## База даних (Supabase)

Міграції лежать у `supabase/migrations/`. Застосувати: Supabase Dashboard → **SQL Editor** → вставити вміст файлу міграції → **Run**. Міграції застосовуються по порядку імен файлів.

На всіх таблицях увімкнено RLS без політик: публічний (publishable) ключ доступу до них не має, api працює із секретним ключем, який RLS обходить.

## Ендпоінти

- `POST /events` — подія від vision (формат у `docs/protocol.md`)
- `GET /events?limit=50&offset=0` — журнал подій
- `PATCH /events/:id/review` — оцінка оператора (свій / свій, дані пізніше / чужий)
- `GET /persons`, `POST /persons`, `DELETE /persons/:id` — «свої»
- `POST /persons/:id/photos` (multipart `photos`), `POST /persons/:id/capture` — додати обличчя з файлів або з камери
- `GET /persons/embeddings` — вектори облич для vision
- WebSocket `ws://localhost:4000/operator` — живі події й статус робота для веб-інтерфейсу; приймає від нього команди керування (`control`)
- WebSocket `ws://localhost:4000/robot` — підключення робота (`robot-bridge`): команди, `ping` раз на секунду, телеметрія

## Змінні середовища

| Змінна | Опис |
|---|---|
| `PORT` | Порт HTTP/WS (за замовчуванням 4000) |
| `SUPABASE_URL` | URL проєкту Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | секретний ключ Supabase (`sb_secret_…`, тільки на бекенді) |
| `ANTHROPIC_API_KEY` | ключ Claude API |
| `VISION_URL` | адреса vision |
| `ALERT_RESUME_TIMEOUT_SECONDS` | через скільки секунд без людей робот повертається до патрулювання |

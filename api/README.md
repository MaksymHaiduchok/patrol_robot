# api

Диспетчер: приймає події від vision, керує роботом, працює з Supabase і Claude API. NestJS + TypeScript.

## Встановлення і запуск

```bash
cp .env.example .env
pnpm install
pnpm start:dev
```

Сервер слухає http://localhost:4000.

## Змінні середовища

| Змінна | Опис |
|---|---|
| `PORT` | Порт HTTP/WS (за замовчуванням 4000) |
| `SUPABASE_URL` | URL проєкту Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (тільки на бекенді) |
| `ANTHROPIC_API_KEY` | ключ Claude API |
| `VISION_URL` | адреса vision |
| `ALERT_RESUME_TIMEOUT_SECONDS` | через скільки секунд без людей робот повертається до патрулювання |

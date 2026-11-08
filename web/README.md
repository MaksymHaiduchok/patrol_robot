# web

Панель оператора: Next.js (App Router), TypeScript, Tailwind.

## Встановлення і запуск

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Відкрити http://localhost:3000.

## Змінні середовища

| Змінна | Опис |
|---|---|
| `NEXT_PUBLIC_API_URL` | HTTP-адреса api |
| `NEXT_PUBLIC_API_WS_URL` | WebSocket-адреса api |
| `NEXT_PUBLIC_VISION_STREAM_URL` | MJPEG-стрім від vision |
| `NEXT_PUBLIC_SUPABASE_URL` | URL проєкту Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key Supabase |

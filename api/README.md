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

Знімки подій — приватний бакет `snapshots` (міграція `20261117120000_snapshots_storage.sql`), фото «своїх» — бакет `faces`.

## Модулі

- `DecisionService` — автоматичні реакції робота на події vision і режим системи (`PATROL`/`STATIONARY`); правила — `docs/protocol.md`, «Автоматичні реакції».
- `ClaudeService` — опис сцени за знімком для `stranger_detected`.
- `NavigationService` — вільне патрулювання: опитує vision `/obstacles` і веде робота в об'їзд перешкод.
- `RobotGateway`, `OperatorGateway` — WebSocket до робота й до web.

На всіх таблицях увімкнено RLS без політик: публічний (publishable) ключ доступу до них не має, api працює із секретним ключем, який RLS обходить.

## Ендпоінти

- `POST /events` — подія від vision (формат у `docs/protocol.md`)
- `GET /events?limit=50&offset=0` — журнал подій
- `PATCH /events/:id/review` — оцінка оператора (свій / свій, дані пізніше / чужий; `status: null` — скасувати)
- `GET /events/:id/snapshot` — `302` на підписане посилання на знімок події (60 с)
- `GET /persons`, `POST /persons`, `DELETE /persons/:id` — «свої»
- `POST /persons/:id/photos` (multipart `photos`), `POST /persons/:id/capture` — додати обличчя з файлів або з камери
- `GET /persons/embeddings` — вектори облич для vision
- WebSocket `ws://localhost:4000/operator` — живі події, статус робота й режим системи для веб-інтерфейсу; приймає від нього команди керування (`control`) і зміну режиму (`set_mode`)
- WebSocket `ws://localhost:4000/robot` — підключення робота (`robot-bridge`): команди, `ping` раз на секунду, телеметрія

## Змінні середовища

| Змінна | Опис |
|---|---|
| `PORT` | Порт HTTP/WS (за замовчуванням 4000) |
| `SUPABASE_URL` | URL проєкту Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | секретний ключ Supabase (`sb_secret_…`, тільки на бекенді) |
| `ANTHROPIC_API_KEY` | ключ Claude API; без нього описи сцени вимкнені |
| `ANTHROPIC_MODEL` | модель для опису сцени (`claude-haiku-5-5`) |
| `CLAUDE_ENABLED` | `false` — не викликати Claude навіть із ключем |
| `CORS_ORIGINS` | дозволені origin-и браузера через кому (`http://localhost:3000`) |
| `NAV_SPEED` | вільне патрулювання: швидкість, % |
| `NAV_REVERSE_MS`, `NAV_TURN_MS` | маневр об'їзду: скільки їхати назад і скільки повертати вперед |
| `NAV_POLL_MS` | як часто питати vision `/obstacles` |
| `NAV_STALE_MS` | гальмо, якщо дані глибини старші |
| `NAV_STALL_MS` | удар: хід подано, а колеса стільки часу не крутяться |
| `VISION_URL` | адреса vision |
| `ALERT_RESUME_TIMEOUT_SECONDS` | через скільки секунд без людей робот повертається до патрулювання |

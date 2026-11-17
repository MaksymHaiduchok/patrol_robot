# Patrol Robot — система керування мобільним роботом на основі комп'ютерного зору

> Цей файл — головна специфікація проєкту. Claude Code: читай його перед будь-якою роботою в репозиторії.
> Працюй **поетапно** (див. розділ «Етапи розробки»). Не реалізовуй наступні етапи, поки поточний не працює і не перевірений.

## 1. Про проєкт

Магістерська робота: «Система керування мобільним роботом на основі комп'ютерного зору»
(англ.: *Computer Vision-Based Mobile Robot Control System*).

Мобільний робот-патрульний їздить територією й оминає перешкоди. Відео з камери аналізується на сервері:
система виявляє людей, розпізнає обличчя («свій» чи «чужий»), зупиняє робота, коли бачить людину,
сповіщає оператора про чужих і додає текстовий опис ситуації через Claude API.
Оператор керує всім через веб-інтерфейс.

Прототип **демонстраційний і мінімально вартісний**: архітектура модульна, тож кожен модуль
(камеру, платформу, сервер) можна замінити на продуктивніший без змін у решті системи.

### Режими роботи
- **Мобільне патрулювання** (основний): камера (смартфон) закріплена на машинці.
- **Стаціонарне спостереження** (розширення): камера знята і стоїть нерухомо, система лише аналізує відео, без керування рухом.

## 2. Апаратна частина

| Компонент | Роль |
|---|---|
| Старий Android-смартфон + застосунок **IP Webcam** | Джерело відео (MJPEG по Wi-Fi, `http://<PHONE_IP>:8080/video`) |
| MacBook (розробка і запуск сервісів) | Vision, API, Web, robot-bridge |
| LEGO Technic Audi RS Q e-tron (42160) з Technic Hub (Control+) | Шасі: 3 мотори Technic L — порт A задні колеса, B передні колеса, D кермо; керування з Мака по Bluetooth LE |

Телефон і Мак в одній Wi-Fi мережі, хаб підключений до Мака по Bluetooth.
Датчика відстані й поворотної голови на платформі немає.
Початковий варіант (Freenove 4WD FNK0043 + Raspberry Pi Zero 2W) відкинуто — див. `docs/decisions.md`.

## 3. Архітектура

```
[Android: IP Webcam] ──MJPEG──► [vision (Python, :8001)] ──HTTP POST /events──► [api (NestJS, :4000)] ◄──WS──► [web (Next.js, :3000)]
                                        │                                              │      │
                                        └── анотований MJPEG /stream ─────────────────────────►│ (<img> у браузері)
                                                                                       │
                                                                              Supabase (Postgres, Storage, Auth)
                                                                                       │
                                                                                WS /robot (JSON)
                                                                                       ▼
                                                       [robot-bridge (Node.js, Mac)] ──Bluetooth LE──► LEGO Technic Hub: мотори ходу й керма
```

**Ключові принципи:**
- `vision` займається **лише комп'ютерним зором**: читає відео, детектує, розпізнає й шле події. Він не знає про робота і не викликає Claude.
- `api` — **диспетчер**: приймає події, ухвалює рішення (зупинити робота, сповістити оператора), працює з Supabase, викликає Claude API, тримає WebSocket із роботом і з фронтендом.
- `robot-bridge` — **виконавець**: транслює команди в мотори хаба, зупиняє їх за watchdog, шле телеметрію.
- Команда `stop`/`alert` роботу надсилається **одразу** після отримання події, а запис у БД, завантаження знімка і виклик Claude йдуть **після або паралельно**. Ніколи не чекати БД перед командою.

## 4. Структура репозиторію

Звичайний репозиторій з папками (без Turborepo/workspaces). Кожна папка — окремий проєкт, і запускається окремо.

```
patrol-robot/
├── CLAUDE.md            # цей файл
├── README.md            # як запустити все локально
├── web/                 # Next.js (App Router) + TypeScript + Tailwind
├── api/                 # NestJS + TypeScript
├── vision/              # Python 3.11+, FastAPI, OpenCV, Ultralytics, керується через uv
├── robot-bridge/        # Node.js + TypeScript: міст api ↔ LEGO Technic Hub (BLE)
├── robot/               # відкинутий варіант (Raspberry Pi Zero 2W + Freenove), не розвивається
├── fake-robot/          # Python або Node: імітатор робота для розробки без заліза
└── docs/
    ├── protocol.md      # повний опис повідомлень між сервісами (джерело правди)
    ├── decisions.md     # журнал архітектурних рішень (для тексту магістерської)
    └── metrics.md       # результати замірів FPS, затримок, точності
```

`web/src/lib/protocol.ts` і `api/src/protocol/protocol.ts` — однакові файли з TS-типами протоколу. Якщо змінюється один, оновлюй обидва і `docs/protocol.md`.

## 5. Стек і порти

| Сервіс | Стек | Порт | Запуск |
|---|---|---|---|
| web | Next.js, TypeScript, Tailwind, Supabase JS client | 3000 | `cd web && pnpm dev` |
| api | NestJS, TypeScript, `@nestjs/websockets` (ws або Socket.IO), Supabase JS, `@anthropic-ai/sdk` | 4000 | `cd api && pnpm start:dev` |
| vision | Python 3.11+, FastAPI, uvicorn, opencv-python, ultralytics (YOLO11n), OpenCV YuNet + SFace, httpx | 8001 | `cd vision && uv run uvicorn main:app --reload --port 8001` |
| robot-bridge | Node.js, TypeScript, `node-poweredup` (BLE), вбудований `WebSocket` | — | `cd robot-bridge && pnpm start` |
| fake-robot | Python `websockets` | — | `cd fake-robot && uv run main.py` |

Менеджер пакетів JS: **pnpm**. Python: **uv**.
На Mac з Apple Silicon YOLO запускається з `device="mps"`, з автоматичним fallback на `cpu`.

## 6. Змінні середовища

У кожній папці є `.env.example` (комітиться) і `.env` (у `.gitignore`). Ключі ніколи не комітити.

**vision/.env**
```
PHONE_STREAM_URL=http://192.168.0.105:8080/video
API_URL=http://localhost:4000
YOLO_MODEL=yolo11n.pt
YOLO_DEVICE=mps
PERSON_CONFIDENCE=0.5
FACE_MATCH_THRESHOLD=0.363        # cosine similarity для SFace, підбирається експериментально
EVENT_COOLDOWN_SECONDS=15         # антидребезг: не частіше однієї події на «ту саму» ситуацію
```

**api/.env**
```
PORT=4000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-5-5
CLAUDE_ENABLED=true
VISION_URL=http://localhost:8001
ALERT_RESUME_TIMEOUT_SECONDS=30
CORS_ORIGINS=http://localhost:3000
```

**web/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_API_WS_URL=ws://localhost:4000
NEXT_PUBLIC_VISION_STREAM_URL=http://localhost:8001/stream
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**robot-bridge/.env** (повний перелік — `robot-bridge/README.md`)
```
API_WS_URL=ws://localhost:4000/robot
ROBOT_ID=lego-audi-01
DRIVE_PORTS=A,B
DRIVE_INVERTED_PORTS=
STEER_PORT=D
STEER_INVERTED=false
STEER_LIMIT_PERCENT=90
WATCHDOG_SECONDS=2
HIDE_BACK_SPEED=50
HIDE_BACK_MS=1500
HIDE_TURN_SIDE=left
HIDE_TURN_SPEED=40
HIDE_TURN_MS=1500
HIDE_FORWARD_SPEED=50
HIDE_FORWARD_MS=1500
```

## 7. Сервіс `vision`

### Ендпоінти
- `GET /stream` — анотований MJPEG-стрім (рамки людей зеленим, «свій» з ім'ям синім, «чужий» червоним).
- `GET /health` — стан, поточний FPS, чи є з'єднання з телефоном.
- `GET /metrics` — середні FPS, час інференсу YOLO, час розпізнавання обличчя (для розділу експериментів).
- `POST /faces/embed` — приймає зображення, повертає вектор обличчя SFace (128 чисел) або помилку «обличчя не знайдено / знайдено кілька».
- `POST /faces/reload` — перечитати базу «своїх» з `api` (`GET {API_URL}/persons/embeddings`) у пам'ять.

### Конвеєр обробки кадру
1. Захоплення кадру з `PHONE_STREAM_URL` в **окремому потоці** (завжди тримати лише останній кадр, без черги).
2. Детекція людей YOLO (`classes=[0]`) **не на кожному кадрі**, а з частотою, яку тягне залізо (ціль 5–10 разів/с). Стрім у браузер при цьому лишається плавним.
3. Якщо є людина: YuNet шукає обличчя в межах рамки людини, SFace рахує вектор, і він порівнюється з векторами в пам'яті (cosine similarity).
4. Формується подія і надсилається в `api` (`POST /events`) з урахуванням антидребезгу.
5. Рамки й підписи малюються на кадрі, і кадр віддається в `/stream`.

### Логіка подій (антидребезг)
- `person_detected` — людина з'явилась у кадрі, а до цього її не було ≥ `EVENT_COOLDOWN_SECONDS`.
- `known_person` — обличчя розпізнане як «своє» (не частіше одного разу на cooldown для однієї людини).
- `stranger_detected` — обличчя знайдене, але не збігається з жодним «своїм» (не частіше одного разу на cooldown).
- `person_left` — у кадрі немає людей протягом ~3 с після присутності.

### Моделі
- YOLO11n (Ultralytics, завантажується автоматично).
- YuNet: `face_detection_yunet_2023mar.onnx`, SFace: `face_recognition_sface_2021dec.onnx` (з OpenCV Zoo). Скрипт `vision/scripts/download_models.py` завантажує їх у `vision/models/` (сама папка в `.gitignore`).

## 8. Сервіс `api` (NestJS)

### Модулі
- `EventsModule` — `POST /events` від vision, `GET /events` (з пагінацією) для web.
- `PersonsModule` — CRUD «своїх»: `POST /persons` (ім'я + фото), `GET /persons`, `DELETE /persons/:id`, `GET /persons/embeddings` (для vision).
- `RobotGateway` — WebSocket `/robot` для робота.
- `OperatorGateway` — WebSocket `/operator` для веб-інтерфейсу.
- `DecisionService` — логіка реакцій (див. нижче).
- `ClaudeService` — опис сцени за знімком через Claude API (асинхронно).
- `SupabaseService` — доступ до БД і Storage (service role key лише тут).

### Логіка реакцій (`DecisionService`)
Лише в режимі `PATROL`:
1. `person_detected` → **негайно** `alert` роботу → сповіщення оператору.
2. `known_person` → `resume` роботу (якщо в кадрі немає чужих) → запис події.
3. `stranger_detected` → робот лишається в `ALERT` → запис події + знімок у Storage → асинхронно `ClaudeService` генерує опис → оновлення події → push оператору.
4. Якщо `ALERT` триває `ALERT_RESUME_TIMEOUT_SECONDS` без нових подій про людей → `resume`.
5. Оператор може будь-коли надіслати `resume`, `stop` або перейти в `MANUAL`. Будь-яка команда оператора знімає «тривогу від системи»: система відпускає робота сама лише тоді, коли сама його зупинила.
6. На `hello` робота api повторює останній `set_state` від оператора.

`onVisionEvent` викликається синхронно до запису в БД; лог `decision <подія> → <команда> in N ms (vision→api M ms)` — для замірів.

У режимі `STATIONARY` команди роботу не надсилаються, лише фіксуються події й сповіщення. Режим тримає `DecisionService`, web змінює його через `set_mode` і отримує `system_mode`.

### Реєстрація «свого»
web → `POST /persons` (multipart: name, photos[]) → api зберігає фото в Storage (`faces/`) → для кожного фото викликає `vision POST /faces/embed` → зберігає вектори в `face_embeddings` → викликає `vision POST /faces/reload`.

### Claude
Модель задається змінною середовища, а промпт описує сцену українською в 1–2 реченнях: що робить людина, одяг, предмети, чи є щось підозріле. **Не просити Claude ідентифікувати людину за обличчям.** Виклик тільки для `stranger_detected`, ніколи на кожен кадр.

## 9. База даних (Supabase)

```sql
create extension if not exists vector;

create table persons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table face_embeddings (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references persons(id) on delete cascade,
  embedding vector(128) not null,
  photo_path text,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('person_detected','known_person','stranger_detected','person_left')),
  person_id uuid references persons(id) on delete set null,
  confidence real,
  snapshot_path text,
  description text,           -- опис від Claude (заповнюється асинхронно)
  mode text,                  -- 'PATROL' | 'STATIONARY'
  created_at timestamptz default now()
);
```

Storage buckets: `snapshots` (знімки подій), `faces` (фото «своїх»).
Міграції лежать у `api/supabase/migrations/`.

**Біометричні дані:** для розпізнавання використовуються лише вектори; фото «своїх» зберігаються тільки для повторного обчислення векторів. Тестування — лише на людях, які дали згоду.

## 10. Протокол WebSocket (повна версія — `docs/protocol.md`)

### api ↔ robot (`/robot`)
Від api до робота:
```json
{ "type": "command", "cmd": "move", "dir": "forward", "speed": 40 }
{ "type": "command", "cmd": "turn", "dir": "left", "speed": 40 }
{ "type": "command", "cmd": "steer", "dir": "left" }
{ "type": "command", "cmd": "stop" }
{ "type": "command", "cmd": "servo", "pan": 90, "tilt": 90 }
{ "type": "command", "cmd": "set_state", "state": "PATROL" }
{ "type": "command", "cmd": "alert" }
{ "type": "command", "cmd": "resume" }
{ "type": "command", "cmd": "hide" }
{ "type": "command", "cmd": "set_home" }
{ "type": "command", "cmd": "return_home" }
{ "type": "ping", "ts": 1731050000000 }
```
`dir`: `forward` | `backward` | `left` | `right`. `speed`: 0–100. `state`: `IDLE` | `PATROL` | `ALERT` | `MANUAL`.
`hide` — заздалегідь заданий маневр за часом (назад → поворот → вперед), після нього робот у `ALERT`. `set_home` / `return_home` — зафіксувати дім і повернутися туди записаним шляхом. `servo` платформа 42160 не підтримує.

Від робота до api:
```json
{ "type": "hello", "robot_id": "lego-audi-01" }
{ "type": "telemetry", "state": "PATROL", "distance_cm": null, "hub": "online", "battery": 87, "home": "recording", "ts": 1731050000000 }
{ "type": "pong", "ts": 1731050000000 }
{ "type": "ack", "cmd": "alert", "ts": 1731050000000 }
```
api шле `ping` раз на секунду, а телеметрія від робота приходить 2–5 разів на секунду.

### api ↔ web (`/operator`)
Від api до web: `event_created`, `event_updated` (з'явився опис Claude), `robot_status` (`connected`, `hub`, `state`, `distance_cm`, `battery`), `system_mode` (`PATROL`/`STATIONARY`).
Від web до api: `control` (`{ "type": "control", "command": <команда робота> }` — ручне керування, стоп, resume, set_state), `set_mode` (`{ "type": "set_mode", "mode": "STATIONARY" }`).

## 11. Робот (`robot-bridge/`)

Процес на Маку, який для api виглядає як робот (WebSocket `/robot`), а моторами хаба керує по Bluetooth LE через `node-poweredup`. Порти й параметри — в `.env`. Під час підключення міст калібрує кермо: шукає лівий і правий упори й рахує центр. Команди моторам шлються напряму в хаб, без черги `node-poweredup`.

### Команди
- Хід і кермо незалежні: `move forward/backward` — лише хід ±`speed`% (`speed: 0` — гальмо); `steer left/right/center` — лише кермо (`STEER_LIMIT_PERCENT`% від повного вивороту або центр); `move`/`turn` `left`/`right` — те саме, що `steer`. У web ↑↓ — хід, ←→ — кермо, їх можна тримати разом.
- `stop` — гальмо, кермо прямо. `alert` — те саме і стан `ALERT`; `resume` повертає стан, що був до `alert`.
- `hide` — маневр за часом (назад → поворот → вперед), далі стоп і `ALERT`. Будь-яка інша команда руху, `stop`, `alert` або watchdog його перериває.
- `set_home` / `return_home` — кожні 20 мс міст записує точку «лічильник коліс + реальний кут керма»; `return_home` їде точками у зворотному порядку без зупинок, виставляючи кермо так, як воно стояло в цьому місці, і зупиняється лише там, де змінювався напрям руху, і вдома. Повернення переривається так само, як `hide`; втрата зв'язку з хабом скидає дім.

### Стани
- `IDLE` — стоїть, чекає команд.
- `PATROL` — навігація `ROUTE`: якщо оператор записав маршрут (дім → проїхати вручну → `PATROL`), машинка їздить ним туди-назад повтором шляху; без маршруту стоїть. Навігація `FREE`: рухом керує api (`NavigationService`) за оцінкою глибини з vision (`GET /obstacles`, Depth Anything V2 Small) — об'їжджає перешкоди, при ударі (колеса не крутяться) здає назад. Міст стартує в цьому стані.
- `ALERT` — стоїть на місці.
- `MANUAL` — лише команди оператора.

### Пріоритети (від найвищого)
1. Немає `ping` від api довше `WATCHDOG_SECONDS` → стоп (watchdog).
2. Втрата зв'язку з хабом → `hub: "offline"` у телеметрії, команди руху ігноруються, міст шукає хаб знову.
3. Команди сервера (`alert`, `stop`, `hide`, `return_home`, ручне керування).

Діагностика портів: `pnpm probe` знаходить хаб, показує пристрої на A–D і по черзі крутить кожен мотор.

### fake-robot
Підключається до `/robot` так само, як справжній, логує команди в консоль, симулює стан і шле фейкову телеметрію (`distance_cm` випадково 20–200). Дозволяє розробити й перевірити api + web без заліза.

## 12. Веб-інтерфейс (`web/`)

Сторінки:
- `/` — **Панель оператора**: живе відео (`<img src={VISION_STREAM_URL}>`), стан робота (online, state, відстань), кнопки керування (стрілки + WASD з клавіатури, стоп, resume), перемикач `PATROL`/`STATIONARY`, стрічка останніх подій у реальному часі.
- `/events` — журнал подій: тип, час, знімок, ім'я або «чужий», опис від Claude.
- `/persons` — «Свої»: список, додати людину (ім'я + 1–5 фото), видалити.
- `/login` — вхід оператора через Supabase Auth (додається на пізньому етапі).

Дизайн простий і функціональний, темна тема, без зайвих бібліотек компонентів (можна shadcn/ui).

## 13. Етапи розробки

Кожен етап закінчується перевіркою «Готово, коли». Після кожного етапу коротко дописуй у `docs/decisions.md`, що зроблено і чому.

| # | Етап | Готово, коли |
|---|---|---|
| 0 | Скелет репо: папки, `.gitignore`, `.env.example`, README, порожні проєкти web/api/vision | Кожен сервіс стартує без помилок |
| 1 | vision: читання стріму з телефону → `GET /stream`; web: сторінка з `<img>` | Відео з телефону видно в браузері на `localhost:3000` |
| 2 | vision: YOLO11n, рамки навколо людей, `/health`, `/metrics` | На відео в браузері людей обведено рамками, FPS видно в `/metrics` |
| 3 | api: Supabase, міграції, `POST/GET /events`; vision шле `person_detected`/`person_left` з антидребезгом | Події з'являються в таблиці `events` |
| 4 | api: `OperatorGateway`; web: стрічка подій у реальному часі, сторінка `/events` | Людина в кадрі → подія миттєво з'являється в браузері |
| 5 | Розпізнавання облич: YuNet + SFace, `/faces/embed`, `/faces/reload`, сторінка `/persons`, події `known_person`/`stranger_detected` | Зареєстрований «свій» підписаний ім'ям, незнайомий позначений червоним «чужий» |
| 6 | Claude: опис сцени для `stranger_detected`, знімки у Storage | У журналі подій біля чужого з'являється знімок і текстовий опис |
| 7 | api: `RobotGateway`, `DecisionService`; fake-robot; керування з web | Людина в кадрі → fake-robot логує `alert`; кнопки керування з web доходять до fake-robot |
| 8 | robot-bridge: LEGO Technic Hub по BLE, команди руху й керма, `hide`, watchdog, телеметрія хаба | Справжня машинка керується з web, зупиняється, коли в кадрі людина, і виконує `hide` |
| 9 | Режим `STATIONARY`, Supabase Auth для оператора, полірування UI | Перемикання режимів працює, вхід за логіном |
| 10 | Заміри для магістерської: FPS, затримка «кадр → стоп робота», точність свій/чужий за різних відстаней і порогів, мобільний vs стаціонарний режим | Таблиці в `docs/metrics.md` |

**Руками:** зібрати LEGO 42160, увімкнути хаб і перевірити порти через `cd robot-bridge && pnpm probe`.

## 14. Правила для Claude Code

- Працюй **по одному етапу**. На початку етапу коротко опиши план, після нього скажи, як перевірити результат.
- Простота понад усе: це демонстраційний прототип для магістерської, а не продакшн. Без зайвих абстракцій, мікросервісних фреймворків, черг повідомлень, Kubernetes тощо.
- TypeScript у strict-режимі. Python 3.11+ з type hints, форматування `ruff`.
- Жодних секретів у коді: усе через `.env`.
- Перед встановленням важких залежностей (torch, CUDA-пакети, нові бібліотеки, яких немає в цьому файлі) спитай.
- Якщо змінюєш протокол, оновлюй **разом** `docs/protocol.md`, `web/src/lib/protocol.ts` і `api/src/protocol/protocol.ts`.
- Логи: у кожному сервісі зрозумілі логи з часовими мітками (вони знадобляться для замірів затримок).
- Кожен сервіс має свій короткий README: як встановити, як запустити, які змінні потрібні.

# Протокол обміну між сервісами

Джерело правди для повідомлень між vision, api, web і robot. TS-типи: `api/src/protocol/protocol.ts` і `web/src/lib/protocol.ts` (однакові файли). Змінюючи протокол, оновлюй усі три місця разом.

Усі часові мітки `ts` — Unix-час у мілісекундах. Поля в JSON — `snake_case`.

## vision → api: `POST /events`

vision надсилає подію, коли змінюється ситуація в кадрі (з урахуванням антидребезгу, див. нижче).

```json
{ "type": "person_detected", "confidence": 0.87, "ts": 1731050000000 }
{ "type": "person_left", "confidence": null, "ts": 1731050012000 }
```

| Поле | Тип | Опис |
|---|---|---|
| `type` | `person_detected` \| `known_person` \| `stranger_detected` \| `person_left` | тип події |
| `confidence` | number \| null | `person_detected`, `stranger_detected` — найбільша впевненість YOLO серед людей; `known_person` — cosine similarity обличчя; `person_left` — `null` |
| `person_id` | string \| null | id «свого» для `known_person`, інакше `null` |
| `ts` | number | час формування події у vision; api за ним рахує затримку vision→api |

Відповідь `201`: збережений запис `EventRecord` (див. нижче). Відповідь `400`: невалідне тіло.

### Антидребезг (vision)

- `person_detected` — людина з'явилась у кадрі, і з моменту попереднього `person_left` минуло ≥ `EVENT_COOLDOWN_SECONDS`.
- `person_left` — у кадрі немає людей ≥ 3 с після `person_detected`.
- Події завжди йдуть парами: `person_left` надсилається лише після `person_detected`. Повернення людини раніше ніж за cooldown після `person_left` нової події не створює.
- `known_person` — обличчя збіглося з «своїм» (cosine similarity ≥ `FACE_MATCH_THRESHOLD`), і цю людину не бачили ≥ cooldown.
- `stranger_detected` — обличчя знайдене, але не збіглося ні з ким, 5 циклів детекції поспіль (~0.5 с), і чужого не бачили ≥ cooldown. Якщо в кадрі одна людина, яку впізнали менш ніж 3 с тому, невпізнане обличчя вважається поворотом голови «свого», а не чужим.

## web → api: `GET /events?limit=50&offset=0`

Журнал подій, від нових до старих. `limit` — 1…200 (за замовчуванням 50), `offset` ≥ 0.

```json
{
  "items": [
    {
      "id": "8f0c…",
      "type": "person_detected",
      "person_id": null,
      "confidence": 0.87,
      "snapshot_path": null,
      "description": null,
      "mode": "PATROL",
      "review_status": null,
      "reviewed_at": null,
      "created_at": "2026-11-08T10:00:00.123+00:00"
    }
  ],
  "total": 1
}
```

## web → api: `PATCH /events/:id/review`

Оцінка оператора для події (модалка «Чи знаємо ми цю людину?»).

```json
{ "status": "known", "person_id": "3b1e…" }
{ "status": "known_pending", "person_id": null }
{ "status": "stranger", "person_id": null }
```

| `status` | Значення |
|---|---|
| `known` | свій, людину вибрано або створено (`person_id` обов'язковий) |
| `known_pending` | свій, дані заповнять пізніше |
| `stranger` | оператор підтвердив, що це чужий |

Відповідь `200`: оновлений `EventRecord`; api також розсилає `event_updated` усім операторам.

## web → api: «свої»

| Метод | Шлях | Опис |
|---|---|---|
| `GET` | `/persons` | список з кількістю фото: `[{ "id", "name", "created_at", "photo_count" }]` |
| `POST` | `/persons` | `{ "name": "Максим" }` → `PersonRecord` |
| `POST` | `/persons/:id/photos` | multipart, поле `photos` (1–5 зображень, до 10 МБ) → `AddPhotosResult` |
| `POST` | `/persons/:id/capture` | зняти обличчя з поточного кадру камери → `AddPhotosResult` або `422` з причиною |
| `DELETE` | `/persons/:id` | видалити людину, її вектори й фото → `204` |

`AddPhotosResult`: `{ "added": 2, "failed": [{ "file": "a.jpg", "reason": "no_face" }] }`. Причини відмови: `no_face`, `multiple_faces`, `invalid_image`.

Фото зберігаються в Supabase Storage (бакет `faces`, приватний) лише для повторного обчислення векторів; для розпізнавання використовуються тільки вектори з `face_embeddings`. Після кожної зміни api викликає `vision POST /faces/reload`.

## vision ↔ api: обличчя

| Хто викликає | Ендпоінт | Опис |
|---|---|---|
| vision → api | `GET /persons/embeddings` | `[{ "person_id", "name", "embedding": [128 чисел] }]`; vision завантажує при старті (повторює кожні 5 с, поки api недоступний) і після `/faces/reload` |
| api → vision | `POST /faces/embed` | тіло — байти зображення → `{ "embedding": [128] }`; `422 { "detail": "no_face" \| "multiple_faces" }`, `400 invalid_image` |
| api → vision | `POST /faces/capture` | поточний кадр камери → `{ "embedding": [128], "image": "<base64 JPEG>" }`; `422` як вище, `503 no_frame` |
| api → vision | `POST /faces/reload` | перечитати вектори з api → `{ "embeddings": N }` |

## api → web: WebSocket `/operator`

Звичайний WebSocket (бібліотека `ws` на api, вбудований `WebSocket` у браузері), повідомлення — JSON.

```json
{ "type": "event_created", "event": { …EventRecord } }
{ "type": "event_updated", "event": { …EventRecord } }
```

- `event_created` — подію збережено в БД.
- `event_updated` — подію змінено (оцінка оператора; з етапу 6 — опис від Claude).

```json
{ "type": "robot_status", "robot": { "robot_id": "lego-audi-01", "connected": true, "hub": "online", "state": "MANUAL", "distance_cm": null, "battery": 87, "home": "recording" } }
```

- `robot_status` — надсилається одразу після підключення оператора і далі щоразу, коли змінюється стан робота. `connected` — чи підключений `robot-bridge` до api, `hub` — чи є в моста зв'язок із хабом. Керувати можна, коли обидва `true`/`online`.

## web → api: WebSocket `/operator`

```json
{ "type": "control", "command": { "type": "command", "cmd": "move", "dir": "forward", "speed": 40 } }
{ "type": "control", "command": { "type": "command", "cmd": "stop" } }
```

`command` — будь-яка команда робота з розділу `/robot`; api перевіряє її (невідомі відкидаються, `speed` обрізається до 0–100) і пересилає роботу. Хід і кермо в web — дві незалежні осі, їх можна тримати разом: ↑/↓ (W/S) шлють `move` з поточною швидкістю (і заново при зміні повзунка), при відпусканні — `move` зі `speed: 0`; ←/→ (A/D) шлють `steer` `left`/`right`, при відпусканні — `steer` `center`. `stop` — при втраті фокуса вікна або виході з ручного режиму; перемикач «Авто/Ручне» шле `set_state` `PATROL`/`MANUAL`. Якщо оператор, який керував рухом, відключився, api шле роботу `stop`.

Web при відкритті завантажує останні події через `GET /events`, далі отримує нові через WebSocket; при розриві перепідключається кожні 2 с.

## api ↔ robot: WebSocket `/robot`

Робота представляє `robot-bridge` (Мак, Bluetooth LE до LEGO Technic Hub). Він підключається до `/robot` як клієнт і перепідключається кожні 2 с. На боці api — `RobotGateway`; одночасно підключений один робот (нове підключення замінює старе). Типи — `api/src/protocol/protocol.ts`, `web/src/lib/protocol.ts` і копія в `robot-bridge/src/protocol.ts`.

### api → robot

```json
{ "type": "command", "cmd": "move", "dir": "forward", "speed": 40 }
{ "type": "command", "cmd": "turn", "dir": "left", "speed": 40 }
{ "type": "command", "cmd": "steer", "dir": "left" }
{ "type": "command", "cmd": "stop" }
{ "type": "command", "cmd": "set_state", "state": "PATROL" }
{ "type": "command", "cmd": "alert" }
{ "type": "command", "cmd": "resume" }
{ "type": "command", "cmd": "hide" }
{ "type": "command", "cmd": "set_home" }
{ "type": "command", "cmd": "return_home" }
{ "type": "command", "cmd": "servo", "pan": 90, "tilt": 90 }
{ "type": "ping", "ts": 1731050000000 }
```

| Команда | Дія на платформі 42160 |
|---|---|
| `move` `forward`/`backward` | лише хід ±`speed`%, кермо не змінюється; `speed: 0` — гальмо |
| `steer` `left`/`right`/`center` | лише кермо: у бік на `STEER_LIMIT_PERCENT`% вивороту або в центр, хід не змінюється |
| `move`/`turn` `left`/`right` | те саме, що `steer` у той бік |
| `stop` | гальмо, кермо прямо |
| `set_state` | змінити стан; `IDLE` і `ALERT` також зупиняють мотори |
| `alert` | стоп і стан `ALERT` |
| `resume` | повернути стан, що був до `alert` |
| `hide` | маневр за часом: назад → поворот → вперед (параметри в `.env` моста), далі стоп і `ALERT`; переривається будь-якою командою руху, `stop`, `alert` або watchdog |
| `set_home` | зафіксувати поточну точку як дім і почати запис шляху (повторний виклик — новий дім, старий шлях стирається) |
| `return_home` | повернутися додому записаним шляхом: їде точками шляху у зворотному порядку без зупинок, виставляючи кермо так, як воно стояло в цьому місці, і зупиняється лише там, де під час запису змінювався напрям руху, і вдома. Ігнорується без `ack`, якщо дім не задано або повернення вже йде; переривається так само, як `hide` (недопройдений шлях зберігається, можна продовжити), а якщо колеса не крутяться `RETURN_STALL_MS` — зупинка. Після прибуття шлях пишеться заново від того самого дому |
| `servo` | не підтримується, ігнорується без `ack` |

`dir`: `forward` \| `backward` \| `left` \| `right`. `speed`: 0–100. `state`: `IDLE` \| `PATROL` \| `ALERT` \| `MANUAL`.
api шле `ping` раз на секунду. Немає `ping` довше `WATCHDOG_SECONDS` (2 с) → міст зупиняє мотори.

### robot → api

```json
{ "type": "hello", "robot_id": "lego-audi-01" }
{ "type": "telemetry", "state": "PATROL", "distance_cm": null, "hub": "online", "battery": 87, "home": "recording", "ts": 1731050000000 }
{ "type": "pong", "ts": 1731050000000 }
{ "type": "ack", "cmd": "alert", "ts": 1731050000000 }
```

| Поле телеметрії | Опис |
|---|---|
| `state` | поточний стан робота |
| `distance_cm` | відстань до перешкоди; на 42160 датчика немає — завжди `null` |
| `hub` | `online` \| `offline` — зв'язок моста з Technic Hub по Bluetooth |
| `battery` | заряд хаба, %; `null`, коли хаб offline |
| `home` | `none` — дім не задано; `recording` — дім задано, шлях пишеться; `returning` — повертається додому. Втрата зв'язку з хабом скидає дім у `none` |

Телеметрія йде кожні 300 мс. `pong` повертає `ts` з `ping` (для заміру затримки). `ack` — команду виконано; поки хаб offline, команди (крім `set_state`) ігноруються без `ack`.

## Ще не реалізовано

`set_mode` (перемикання `PATROL`/`STATIONARY`) і `DecisionService` (автоматичні `alert`/`resume`/`hide` за подіями vision) — етап 7, попередній опис у `CLAUDE.md`, розділи 8 і 10.

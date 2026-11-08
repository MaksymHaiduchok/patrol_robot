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

Web при відкритті завантажує останні події через `GET /events`, далі отримує нові через WebSocket; при розриві перепідключається кожні 2 с.

## Ще не реалізовано

WebSocket `/robot` (api ↔ robot) і повідомлення web → api через `/operator` (`control`, `set_mode`, `resume`) — етап 7, попередній опис у `CLAUDE.md`, розділ 10.

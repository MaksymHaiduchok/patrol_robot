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

Обробка в api (`EventsService.create`): лог → **`DecisionService.onVisionEvent` синхронно, до запису в БД** (див. «Автоматичні реакції») → insert у `events` з поточним режимом системи в `mode` → `event_created` операторам → відповідь vision. Для `person_detected` і `stranger_detected` після відповіді, у фоні: знімок з vision → Storage `snapshots/<event_id>.jpg` → `snapshot_path` → `event_updated`; для `stranger_detected` далі опис від Claude → `description` → `event_updated`.

## api → vision: `GET /snapshot`

| Запит | Відповідь |
|---|---|
| `GET /snapshot?ts=<ts події>` | сирий кадр (без рамок), на якому vision сформував подію `person_detected` / `stranger_detected` з цим `ts`, `image/jpeg`; vision тримає 20 останніх |
| `GET /snapshot` | останній сирий кадр з камери |

`404 no_snapshot` — кадру немає (подія давня або камера не підключена). Знімок береться саме з кадру події, а не «останнього на момент запиту»: інакше людина могла б уже вийти з кадру, поки api отримає подію.

## api → vision: `GET /obstacles`

Оцінка перешкод камерою (Depth Anything V2 Small, відносна глибина). api опитує її кожні 100 мс лише у вільному патрулі.

```json
{ "ts": 1731050000000, "frame_id": 1234, "age_ms": 60, "near_ratio": 0.6,
  "zones": { "left": 0.31, "center": 0.82, "right": 0.44 },
  "near": { "left": false, "center": true, "right": false } }
```

Кадр ділиться на три вертикальні зони. У кожній береться 80-й перцентиль «близькості» в горизонтальній смузі `DEPTH_BAND_TOP`…`DEPTH_BAND_BOTTOM` (частки висоти кадру) і ділиться на еталон: `DEPTH_REFERENCE=floor` — медіана близькості підлоги в нижніх `DEPTH_FLOOR_ROWS` кадру, `frame` — медіана всього кадру (коли смуга опущена до низу кадру і підлоги-еталона там уже немає; тоді `near` означає «помітно ближче за типову відстань у кадрі», поріг ~1.5). Підлога прямо перед машинкою завжди на однаковій відстані від камери, тож відношення не залежить від масштабу, який модель відносної глибини вибирає для кожного кадру: ~1 — перешкода так само близько, як підлога під носом машинки; менше — далі. `near` — `zone ≥ OBSTACLE_NEAR_RATIO`. `503`, якщо глибина вимкнена (`DEPTH_ENABLED=0`) або ще не порахована.

## Вільне патрулювання (`NavigationService`, api)

Режим навігації: `ROUTE` (маршрутом, за замовчуванням) або `FREE` (сам, за камерою). web → api `{ "type": "set_navigation", "mode": "FREE" }`, api → web `{ "type": "navigation_mode", "mode": "FREE" }` (при підключенні й при зміні). api пересилає режим мосту командою `navigation`, щоб той не запускав патруль маршрутом.

Їде, лише коли режим системи `PATROL`, робот онлайн у стані `PATROL` і не повертається додому. Кожні 100 мс:

- центр вільний → вперед `NAV_SPEED`%, кермо від зайнятого боку (ліво зайняте → вправо, право → вліво, інакше прямо);
- центр зайнятий → назад `NAV_REVERSE_MS` з кермом від вільнішого боку, потім вперед `NAV_TURN_MS` з кермом у вільніший бік, далі знову за камерою;
- лічильник коліс з телеметрії (`odometer`) не росте `NAV_STALL_MS`, хоча подано хід, — удар, той самий маневр назад;
- даних глибини немає або вони старші за `NAV_STALE_MS` — гальмо, поки не з'являться.

`alert` від `DecisionService` зупиняє (міст у `ALERT` не приймає `move`/`steer`), після `resume` їзда продовжується. Команда оператора (`stop`, `hide`, `return_home`…) ставить вільну їзду на паузу до `resume` або `set_state`. Команди моторам api шле лише при зміні напрямку чи керма. Лог: `navigation: obstacle ahead (L 0.70 C 0.90 R 0.40) → reverse, then right`.

## Автоматичні реакції (`DecisionService`, api)

Працюють лише в режимі системи `PATROL`, коли робот підключений і його стан `PATROL` (або `ALERT`, який увімкнула сама система). У `MANUAL`, `IDLE`, офлайн і в режимі `STATIONARY` робота не чіпають.

| Подія | Реакція |
|---|---|
| `person_detected` | `alert` (якщо робот у `PATROL`), система запам'ятовує, що тривогу ввімкнула вона |
| `stranger_detected` | у візиті був чужий; лишається `ALERT` (якщо робот ще в `PATROL` — `alert`) |
| `known_person` | якщо тривогу ввімкнула система і в цьому візиті не було чужого — `resume` |
| `person_left` | скидає «чужий у візиті», від цього моменту йде таймер |
| `ALERT_RESUME_TIMEOUT_SECONDS` (30 с) після `person_left` без нових подій про людей | `resume`. Поки візит відкритий (був `person_detected` / `stranger_detected` / `known_person`, а `person_left` ще ні), таймер робота не відпускає: vision не повторює подій, поки людина стоїть у кадрі |

Будь-яка команда оператора (`control`) знімає «тривогу від системи»: оператор перебрав керування, і система сама робота не відпустить. Якщо робот вийшов з `ALERT` іншим шляхом (оператор, відключення), система теж забуває про свою тривогу.

Лог для заміру затримки: `decision person_detected → alert in 1 ms (vision→api 6 ms)` — час від отримання події api до відправки команди і час від формування події у vision до отримання api. Для таймера — `decision timeout → resume …`.

## Режим системи: `PATROL` / `STATIONARY`

Режим тримає `DecisionService` в пам'яті api (після перезапуску api — `PATROL`). Його записують у `events.mode`.

- web → api: `{ "type": "set_mode", "mode": "STATIONARY" }`.
- api → web: `{ "type": "system_mode", "mode": "STATIONARY" }` — одразу після підключення оператора і всім операторам при кожній зміні (кілька вкладок бачать один режим).
- Перехід у `STATIONARY` одноразово шле роботу `stop`. У `STATIONARY` api пересилає роботу від оператора лише `stop`, решту відкидає з попередженням у лозі; `DecisionService` команд не шле.

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
| `null` | скасувати оцінку (кнопка «Скасувати» в тості); `person_id` має бути `null`, `reviewed_at` теж скидається |

Відповідь `200`: оновлений `EventRecord`; api також розсилає `event_updated` усім операторам.

## web → api: `GET /events/:id/snapshot`

`302` на підписане посилання Supabase Storage (бакет `snapshots`, приватний, посилання діє 60 с), тож його можна ставити прямо в `<img src>`. `404`, якщо в події немає знімка.

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
- `event_updated` — подію змінено: оцінка оператора, з'явився знімок (`snapshot_path`), з'явився опис від Claude (`description`).
- `system_mode` — див. «Режим системи».

```json
{ "type": "robot_status", "robot": { "robot_id": "lego-audi-01", "connected": true, "hub": "online", "state": "MANUAL", "distance_cm": null, "battery": 87, "home": "recording" } }
```

- `robot_status` — надсилається одразу після підключення оператора і далі щоразу, коли змінюється стан робота. `connected` — чи підключений `robot-bridge` до api, `hub` — чи є в моста зв'язок із хабом. Керувати можна, коли обидва `true`/`online`.

## web → api: WebSocket `/operator`

```json
{ "type": "control", "command": { "type": "command", "cmd": "move", "dir": "forward", "speed": 40 } }
{ "type": "control", "command": { "type": "command", "cmd": "stop" } }
```

`command` — будь-яка команда робота з розділу `/robot`; api перевіряє її (невідомі відкидаються, `speed` обрізається до 0–100) і пересилає роботу. Хід і кермо в web — дві незалежні осі, їх можна тримати разом: ↑/↓ (W/S) шлють `move` з поточною швидкістю (і заново при зміні повзунка), при відпусканні — `move` зі `speed: 0`; ←/→ (A/D) шлють `steer` `left`/`right`, при відпусканні — `steer` `center`. `stop` — при втраті фокуса вікна або виході з ручного режиму; перемикач «Авто/Ручне» шле `stop` і `set_state` `PATROL`/`MANUAL`, а положення перемикача web бере з `robot_status.state` (`MANUAL` → «Ручне», інакше «Авто»). Банер «Робот зупинено» web показує за `robot_status.state === "ALERT"`; «Продовжити патруль» шле `resume`.

```json
{ "type": "set_mode", "mode": "PATROL" }
``` Якщо оператор, який керував рухом, відключився, api шле роботу `stop`.

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
{ "type": "command", "cmd": "navigation", "mode": "FREE" }
{ "type": "command", "cmd": "servo", "pan": 90, "tilt": 90 }
{ "type": "ping", "ts": 1731050000000 }
```

| Команда | Дія на платформі 42160 |
|---|---|
| `move` `forward`/`backward` | лише хід ±`speed`%, кермо не змінюється; `speed: 0` — гальмо |
| `steer` `left`/`right`/`center` | лише кермо: у бік на `STEER_LIMIT_PERCENT`% вивороту або в центр, хід не змінюється |
| `move`/`turn` `left`/`right` | те саме, що `steer` у той бік |
| `stop` | гальмо, кермо прямо |
| `set_state` | змінити стан; усе, крім `PATROL`, зупиняє мотори. `PATROL` запускає патруль маршрутом (див. нижче), `MANUAL`/`IDLE` його завершують |
| `alert` | стоп і стан `ALERT` |
| `resume` | повернути стан, що був до `alert`; якщо це `PATROL` з маршрутом — патруль їде далі з того місця |
| `hide` | маневр за часом: назад → поворот → вперед (параметри в `.env` моста), далі стоп і `ALERT`; переривається будь-якою командою руху, `stop`, `alert` або watchdog |
| `set_home` | зафіксувати поточну точку як дім і почати запис шляху (повторний виклик — новий дім, старий шлях стирається) |
| `return_home` | повернутися додому записаним шляхом: їде точками шляху у зворотному порядку без зупинок, виставляючи кермо так, як воно стояло в цьому місці, і зупиняється лише там, де під час запису змінювався напрям руху, і вдома. Ігнорується без `ack`, якщо дім не задано або повернення вже йде; переривається так само, як `hide` (недопройдений шлях зберігається, можна продовжити), а якщо колеса не крутяться `RETURN_STALL_MS` — зупинка. Після прибуття шлях пишеться заново від того самого дому |
| `navigation` | `ROUTE` — у `PATROL` їздити записаним маршрутом; `FREE` — маршрут не запускати (кермує api за камерою); перемикання на `FREE` завершує патруль маршрутом. Шле тільки api (`set_navigation` від оператора), з `control` відкидається |
| `servo` | не підтримується, ігнорується без `ack` |

У стані `ALERT` міст ігнорує `move`/`turn`/`steer` (без `ack`) — щоб команда руху, надіслана до того, як телеметрія показала `ALERT`, не зрушила машинку.

**Патруль маршрутом.** Датчика перешкод немає, тож машинка сама не вибирає, куди їхати, а повторює маршрут, який проїхав оператор: у `MANUAL` `set_home` → проїхати маршрут → `set_state PATROL`. Записаний від дому шлях стає маршрутом (`home: patrolling`), і машинка їздить ним туди-назад тим самим механізмом, що й `return_home` (на дім — точки у зворотному порядку, на кінець — у прямому). Маршрут коротший за 90° коліс ігнорується. `alert`, `stop`, watchdog, будь-яка команда руху патруль призупиняють (недопройдена частина ділянки зберігається); `resume` або відновлення `ping` у стані `PATROL` — продовжують. `set_state MANUAL`/`IDLE`, `set_home`, `return_home` завершують патруль; шлях від дому до поточної точки знову стає звичайним записом, тож `return_home` після патруля працює. Якщо колеса не крутяться `RETURN_STALL_MS` — стоп і `ALERT`.

Коли робот підключається (`hello`), api повторює йому останні `navigation` і `set_state`, які надсилались (якщо надсилались), щоб після перезапуску моста стан не розходився з web. Сам міст стартує в `PATROL`.

`dir`: `forward` \| `backward` \| `left` \| `right`. `speed`: 0–100. `state`: `IDLE` \| `PATROL` \| `ALERT` \| `MANUAL`.
api шле `ping` раз на секунду. Немає `ping` довше `WATCHDOG_SECONDS` (2 с) → міст зупиняє мотори.

### robot → api

```json
{ "type": "hello", "robot_id": "lego-audi-01" }
{ "type": "telemetry", "state": "PATROL", "distance_cm": null, "hub": "online", "battery": 87, "home": "recording", "odometer": 1520, "ts": 1731050000000 }
{ "type": "pong", "ts": 1731050000000 }
{ "type": "ack", "cmd": "alert", "ts": 1731050000000 }
```

| Поле телеметрії | Опис |
|---|---|
| `state` | поточний стан робота |
| `distance_cm` | відстань до перешкоди; на 42160 датчика немає — завжди `null` |
| `hub` | `online` \| `offline` — зв'язок моста з Technic Hub по Bluetooth |
| `battery` | заряд хаба, %; `null`, коли хаб offline |
| `odometer` | лічильник коліс, градуси (середнє ходових моторів); `null`, коли хаб offline. Необов'язкове поле. api за ним визначає удар у вільному патрулі |
| `home` | `none` — дім не задано; `recording` — дім задано, шлях пишеться; `returning` — повертається додому; `patrolling` — є маршрут патруля. Втрата зв'язку з хабом скидає дім і маршрут у `none` |

Телеметрія йде кожні 300 мс. `pong` повертає `ts` з `ping` (для заміру затримки). `ack` — команду виконано; поки хаб offline, команди (крім `set_state`) ігноруються без `ack`.

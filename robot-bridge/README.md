# robot-bridge

Міст між api і мобільною платформою LEGO Technic Audi RS Q e-tron (42160) з Technic Hub (Control+). Працює на Маку: підключається до api як робот через WebSocket `/robot`, а до хаба — по Bluetooth LE через [node-poweredup](https://github.com/nathankellenicki/node-poweredup). Node.js + TypeScript.

## Встановлення і запуск

```bash
cp .env.example .env
pnpm install
pnpm start
```

Перед запуском **виставити передні колеса прямо**: під час підключення поточне положення мотора керма стає нулем. Хаб увімкнути кнопкою (має блимати). При першому запуску macOS попросить дати терміналу доступ до Bluetooth (System Settings → Privacy & Security → Bluetooth).

`pnpm probe` — діагностика: знаходить хаб, показує пристрої на портах A–D і по черзі крутить кожен мотор на 30% 1 с.

## Порти моделі 42160

| Порт | Мотор | Роль |
|---|---|---|
| A | Technic L | задні колеса |
| B | Technic L | передні колеса |
| C | — | — |
| D | Technic L | кермо |

## Поведінка

- `move forward/backward` — кермо прямо, хід ±`speed`%. `move left/right` і `turn left/right` — кермо в бік на `STEER_ANGLE`° і хід вперед на `speed`% (машина не розвертається на місці).
- `stop` — гальмо на ходових, кермо прямо. `alert` — те саме і стан `ALERT`; `resume` повертає стан, що був до `alert`.
- `hide` — маневр за часом: назад → поворот → вперед, потім стоп і стан `ALERT`. Будь-яка інша команда руху, `stop`, `alert` або watchdog його перериває.
- `servo` не підтримується (немає поворотної голови). Датчика відстані немає, тому `distance_cm` у телеметрії — `null`, а `PATROL` не рухає машину сам.
- Watchdog: немає `ping` від api довше `WATCHDOG_SECONDS` → мотори зупиняються.
- Втрата зв'язку з хабом → `hub: "offline"` у телеметрії, команди руху ігноруються, міст шукає хаб знову.

## Змінні середовища

| Змінна | Опис |
|---|---|
| `API_WS_URL` | WebSocket `/robot` на api |
| `ROBOT_ID` | ідентифікатор робота |
| `DRIVE_PORTS` | порти ходових моторів через кому |
| `DRIVE_INVERTED_PORTS` | ходові порти, які треба крутити в протилежний бік, щоб «вперед» було вперед |
| `STEER_PORT` | порт мотора керма |
| `STEER_INVERTED` | `true`, якщо `left` повертає вправо |
| `STEER_ANGLE` | кут мотора керма для повного повороту, градуси |
| `STEER_SPEED` | швидкість мотора керма, % |
| `WATCHDOG_SECONDS` | стоп, якщо довше немає `ping` від api |
| `TELEMETRY_INTERVAL_MS` | період телеметрії |
| `HIDE_BACK_SPEED`, `HIDE_BACK_MS` | hide: їхати назад |
| `HIDE_TURN_SIDE`, `HIDE_TURN_SPEED`, `HIDE_TURN_MS` | hide: поворот (`left`/`right`) з ходом вперед |
| `HIDE_FORWARD_SPEED`, `HIDE_FORWARD_MS` | hide: їхати прямо вперед |

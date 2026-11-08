# robot

Бортовий код для Raspberry Pi Zero 2W на шасі Freenove 4WD (FNK0043). Реалізується на етапі 8.

## Запуск (на Pi)

```bash
cp .env.example .env
python3 main.py
```

## Змінні середовища

| Змінна | Опис |
|---|---|
| `API_WS_URL` | WebSocket `/robot` на api |
| `ROBOT_ID` | ідентифікатор робота |
| `OBSTACLE_STOP_CM` | відстань до перешкоди для зупинки |
| `WATCHDOG_SECONDS` | стоп, якщо довше немає `ping` від сервера |

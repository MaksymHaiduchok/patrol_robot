import { Car } from "./car.js";
import { loadConfig } from "./config.js";
import { hideSteps } from "./hide.js";
import { log, sleep } from "./log.js";
import type { ApiToRobotMessage, RobotCommand, RobotState, RobotToApiMessage } from "./protocol.js";

const RECONNECT_DELAY_MS = 2000;

const config = loadConfig();
const car = new Car(config);

let socket: WebSocket | null = null;
let state: RobotState = "IDLE";
let stateBeforeAlert: RobotState = "PATROL";
let lastPingAt = Date.now();
let watchdogTripped = false;
let hideRun = 0;

const send = (message: RobotToApiMessage): void => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const ack = (cmd: RobotCommand["cmd"]): void => {
  send({ type: "ack", cmd, ts: Date.now() });
};

const setState = (next: RobotState): void => {
  if (state !== next) {
    log(`Стан: ${state} → ${next}`);
    state = next;
  }
};

const halt = (): void => {
  hideRun += 1;
  car.stop();
};

const hide = async (): Promise<void> => {
  const run = ++hideRun;

  log("Hide: почато");
  for (const step of hideSteps(config)) {
    if (run !== hideRun) {
      log("Hide: перервано");
      return;
    }
    log(`Hide: ${step.name}, ${step.power}% на ${step.ms} мс`);
    car.steer(step.side);
    car.drive(step.power);
    await sleep(step.ms);
  }
  if (run === hideRun) {
    car.stop();
    setState("ALERT");
    log("Hide: завершено, чекаю в ALERT");
  }
};

const handleCommand = (command: RobotCommand): void => {
  if (car.status === "offline" && command.cmd !== "set_state") {
    log(`Команда ${command.cmd} проігнорована: хаб offline`);
    return;
  }
  log(`Команда: ${JSON.stringify(command)}`);

  switch (command.cmd) {
    case "move":
      hideRun += 1;
      if (command.dir === "forward" || command.dir === "backward") {
        car.steer(null);
        car.drive(command.dir === "forward" ? command.speed : -command.speed);
      } else {
        car.steer(command.dir);
        car.drive(command.speed);
      }
      break;
    case "turn":
      hideRun += 1;
      if (command.dir === "left" || command.dir === "right") {
        car.steer(command.dir);
        car.drive(command.speed);
      } else {
        car.steer(null);
        car.drive(command.dir === "forward" ? command.speed : -command.speed);
      }
      break;
    case "stop":
      halt();
      break;
    case "servo":
      log("servo не підтримується: на платформі немає поворотної голови");
      return;
    case "set_state":
      if (command.state === "IDLE" || command.state === "ALERT") {
        halt();
      }
      setState(command.state);
      break;
    case "alert":
      halt();
      if (state !== "ALERT") {
        stateBeforeAlert = state;
      }
      setState("ALERT");
      break;
    case "resume":
      setState(stateBeforeAlert);
      break;
    case "hide":
      void hide();
      break;
  }
  ack(command.cmd);
};

const handleMessage = (raw: string): void => {
  let message: ApiToRobotMessage;
  try {
    message = JSON.parse(raw) as ApiToRobotMessage;
  } catch {
    log(`Невалідний JSON від api: ${raw}`);
    return;
  }

  if (message.type === "ping") {
    lastPingAt = Date.now();
    if (watchdogTripped) {
      watchdogTripped = false;
      log("Watchdog: ping від api відновився");
    }
    send({ type: "pong", ts: message.ts });
    return;
  }
  if (message.type === "command") {
    handleCommand(message);
    return;
  }
  log(`Невідоме повідомлення від api: ${raw}`);
};

const connect = (): void => {
  log(`api: підключаюсь до ${config.apiWsUrl}`);
  const ws = new WebSocket(config.apiWsUrl);
  socket = ws;

  ws.addEventListener("open", () => {
    log("api: підключено");
    lastPingAt = Date.now();
    send({ type: "hello", robot_id: config.robotId });
  });
  ws.addEventListener("message", (event) => {
    handleMessage(String(event.data));
  });
  ws.addEventListener("close", () => {
    socket = null;
    log(`api: з'єднання закрито, повтор через ${RECONNECT_DELAY_MS / 1000} с`);
    setTimeout(connect, RECONNECT_DELAY_MS);
  });
  ws.addEventListener("error", () => {
    log("api: помилка з'єднання");
  });
};

const checkWatchdog = (): void => {
  if (watchdogTripped || Date.now() - lastPingAt <= config.watchdogSeconds * 1000) {
    return;
  }
  watchdogTripped = true;
  log(`Watchdog: немає ping ${config.watchdogSeconds} с, зупиняю мотори`);
  if (car.status === "online") {
    halt();
  }
};

const sendTelemetry = (): void => {
  send({
    type: "telemetry",
    state,
    distance_cm: null,
    hub: car.status,
    battery: car.battery,
    ts: Date.now(),
  });
};

const shutdown = (): void => {
  log("Завершення: зупиняю мотори");
  if (car.status === "online") {
    halt();
  }
  setTimeout(() => process.exit(0), 300);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

log(`robot-bridge ${config.robotId}: хід ${config.drivePorts.join(",")}, кермо ${config.steerPort}`);
await car.start();
connect();
setInterval(checkWatchdog, 200);
setInterval(sendTelemetry, config.telemetryIntervalMs);

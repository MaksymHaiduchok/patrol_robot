import { Car } from "./car.js";
import { loadConfig } from "./config.js";
import { hideSteps } from "./hide.js";
import { pathLength, returnHome } from "./home.js";
import { log, sleep } from "./log.js";
import { PathRecorder, type PathPoint } from "./path.js";
import type { ApiToRobotMessage, HomeState, RobotCommand, RobotState, RobotToApiMessage } from "./protocol.js";

const RECONNECT_DELAY_MS = 2000;
const PATH_SAMPLE_MS = 20;
const MIN_ROUTE_DEGREES = 90;

const config = loadConfig();
const car = new Car(config);
const recorder = new PathRecorder();

let socket: WebSocket | null = null;
let state: RobotState = "PATROL";
let stateBeforeAlert: RobotState = "PATROL";
let lastPingAt = Date.now();
let watchdogTripped = false;
let maneuverRun = 0;
let homeVersion = 0;
let returning = false;
let route: PathPoint[] | null = null;
let towardHome = true;
let legPath: PathPoint[] | null = null;
let patrolTask: Promise<void> | null = null;
let patrolRestart = false;

car.onDisconnect(() => {
  if (recorder.hasHome) {
    log("Дім скинуто: втрачено зв'язок з хабом, записаний шлях більше не точний");
  }
  homeVersion += 1;
  recorder.clear();
  route = null;
  legPath = null;
});

const currentPoint = (): PathPoint => ({ odometer: car.driveDegrees(), steerAngle: car.steerAngle() ?? 0 });

const recordPath = (): void => {
  if (car.status === "online" && car.steerAngle() !== null) {
    recorder.sample(currentPoint());
  }
};

const homeState = (): HomeState =>
  returning ? "returning" : route ? "patrolling" : recorder.hasHome ? "recording" : "none";

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
  maneuverRun += 1;
  patrolRestart = false;
  car.stop();
};

const hide = async (): Promise<void> => {
  const run = ++maneuverRun;

  log("Hide: почато");
  for (const step of hideSteps(config)) {
    if (run !== maneuverRun) {
      log("Hide: перервано");
      return;
    }
    log(`Hide: ${step.name}, ${step.power}% на ${step.ms} мс`);
    car.steer(step.side);
    car.drive(step.power);
    await sleep(step.ms);
  }
  if (run === maneuverRun) {
    car.stop();
    setState("ALERT");
    log("Hide: завершено, чекаю в ALERT");
  }
};

const legStart = (points: PathPoint[]): PathPoint[] =>
  towardHome ? [...points, currentPoint()] : [...[...points].reverse(), currentPoint()];

const pathFromHome = (points: PathPoint[]): PathPoint[] => {
  if (towardHome) {
    return legPath ?? [...points, currentPoint()];
  }
  const unvisited = legPath ? legPath.length - 1 : points.length;
  return [...points.slice(0, Math.max(1, points.length - unvisited)), currentPoint()];
};

const patrol = async (points: PathPoint[]): Promise<void> => {
  const run = ++maneuverRun;
  const version = homeVersion;
  log("Патруль: їду маршрутом між домом і кінцем маршруту");
  while (run === maneuverRun && version === homeVersion && route === points) {
    const path = legPath ?? legStart(points);
    const label = towardHome ? "patrol → дім" : "patrol → кінець маршруту";
    const result = await returnHome(car, config, path, () => run !== maneuverRun, label);
    if (version !== homeVersion || route !== points) {
      return;
    }
    if (result.reason === "home") {
      towardHome = !towardHome;
      legPath = null;
      continue;
    }
    legPath = result.remaining;
    if (result.reason === "stalled") {
      car.stop();
      stateBeforeAlert = "PATROL";
      setState("ALERT");
      log("Патруль: колеса не крутяться (застряг?), зупинено в ALERT; «resume» продовжить");
    } else {
      log("Патруль: призупинено");
    }
    return;
  }
};

const startPatrol = (): void => {
  if (patrolTask) {
    patrolRestart = true;
    return;
  }
  if (state !== "PATROL" || car.status === "offline" || returning) {
    return;
  }
  if (!route) {
    if (!recorder.hasHome) {
      return;
    }
    const points = recorder.take(currentPoint());
    if (pathLength(points) < MIN_ROUTE_DEGREES) {
      recorder.resume(points);
      log(`Патруль: маршрут коротший за ${MIN_ROUTE_DEGREES}° коліс — проїдьте його вручну від дому`);
      return;
    }
    route = points;
    towardHome = true;
    legPath = null;
    log(`Патруль: маршрут ${Math.round(pathLength(points))}° коліс, ${points.length} точок`);
  }
  const points = route;
  patrolTask = patrol(points).finally(() => {
    patrolTask = null;
    if (patrolRestart) {
      patrolRestart = false;
      startPatrol();
    }
  });
};

const endPatrol = async (): Promise<void> => {
  maneuverRun += 1;
  patrolRestart = false;
  await patrolTask;
  if (!route) {
    return;
  }
  recorder.resume(pathFromHome(route));
  route = null;
  legPath = null;
  log("Патруль: завершено, шлях від дому записується далі");
};

const setHome = (): void => {
  maneuverRun += 1;
  homeVersion += 1;
  route = null;
  legPath = null;
  car.brakeDrive();
  recorder.begin(currentPoint());
  log("Дім: точку зафіксовано, записую шлях");
};

const goHome = async (): Promise<void> => {
  const run = ++maneuverRun;
  const version = homeVersion;
  returning = true;
  const path = recorder.take(currentPoint());
  const result = await returnHome(car, config, path, () => run !== maneuverRun, "return_home");
  returning = false;
  if (version !== homeVersion) {
    return;
  }
  recorder.resume(result.remaining);
  if (result.reason === "home") {
    log("Додому: прибули, шлях записується заново від дому");
  } else if (result.reason === "stalled") {
    car.stop();
    log("Додому: колеса не крутяться (застряг?), зупинено; недопройдений шлях збережено");
  } else {
    log("Додому: перервано, недопройдений шлях збережено");
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
      maneuverRun += 1;
      if (command.dir === "left" || command.dir === "right") {
        car.steer(command.dir);
      } else if (command.speed === 0) {
        car.brakeDrive();
      } else {
        car.drive(command.dir === "forward" ? command.speed : -command.speed);
      }
      break;
    case "turn":
      maneuverRun += 1;
      car.steer(command.dir === "left" || command.dir === "right" ? command.dir : null);
      break;
    case "steer":
      maneuverRun += 1;
      car.steer(command.dir === "center" ? null : command.dir);
      break;
    case "stop":
      halt();
      break;
    case "servo":
      log("servo не підтримується: на платформі немає поворотної голови");
      return;
    case "set_state":
      if (command.state !== "PATROL") {
        halt();
      }
      setState(command.state);
      if (command.state === "PATROL") {
        startPatrol();
      } else if (command.state !== "ALERT") {
        void endPatrol();
      }
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
      startPatrol();
      break;
    case "hide":
      void hide();
      break;
    case "set_home":
      setHome();
      break;
    case "return_home":
      if (!recorder.hasHome) {
        log("Додому: точку дому не зафіксовано");
        return;
      }
      if (returning) {
        log("Додому: уже повертаюсь");
        return;
      }
      void endPatrol().then(goHome);
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
      startPatrol();
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
    home: homeState(),
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
setInterval(recordPath, PATH_SAMPLE_MS);
setInterval(sendTelemetry, config.telemetryIntervalMs);

import type { Car } from "./car.js";
import type { Config } from "./config.js";
import { log, sleep } from "./log.js";
import type { PathPoint } from "./path.js";

const LOOP_MS = 20;
const BRAKE_SETTLE_MS = 250;
const STEER_TOLERANCE_DEGREES = 5;
const STEER_UPDATE_DEGREES = 2;
const CORRECTION_ATTEMPTS = 2;
const VELOCITY_SMOOTHING = 0.3;

type StopReason = "done" | "cancelled" | "stalled";

export type ReturnResult = {
  remaining: PathPoint[];
  reason: "home" | "cancelled" | "stalled";
};

type Run = {
  from: number;
  to: number;
  direction: number;
};

const findRun = (points: PathPoint[], from: number): Run | null => {
  let start = from;
  while (start > 0 && points[start - 1].odometer === points[start].odometer) {
    start -= 1;
  }
  if (start === 0) {
    return null;
  }
  const direction = Math.sign(points[start - 1].odometer - points[start].odometer);
  let to = start - 1;
  while (to > 0 && Math.sign(points[to - 1].odometer - points[to].odometer) !== -direction) {
    to -= 1;
  }
  return { from: start, to, direction };
};

const waitForSteer = async (car: Car, angle: number, timeoutMs: number, isCancelled: () => boolean): Promise<void> => {
  car.steerTo(angle);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs && !isCancelled()) {
    const current = car.steerAngle();
    if (current !== null && Math.abs(current - angle) <= STEER_TOLERANCE_DEGREES) {
      return;
    }
    await sleep(LOOP_MS);
  }
};

const driveTo = async (
  car: Car,
  config: Config,
  target: number,
  maxSpeed: number,
  steerAt: (odometer: number) => number,
  isCancelled: () => boolean,
): Promise<StopReason> => {
  const { slowSpeed, slowZoneDegrees, stallMs, steerLookaheadMs } = config.returnHome;
  const direction = Math.sign(target - car.driveDegrees());
  let lastOdometer = car.driveDegrees();
  let lastProgressAt = Date.now();
  let previousOdometer = lastOdometer;
  let previousAt = Date.now();
  let velocity = 0;
  let power = 0;
  let steer = Number.NaN;
  let reason: StopReason = "done";

  while (true) {
    if (isCancelled() || car.status === "offline") {
      reason = "cancelled";
      break;
    }
    const odometer = car.driveDegrees();
    const now = Date.now();
    if (now > previousAt) {
      const instant = ((odometer - previousOdometer) / (now - previousAt)) * 1000;
      velocity += (instant - velocity) * VELOCITY_SMOOTHING;
      previousOdometer = odometer;
      previousAt = now;
    }
    const left = target - odometer;
    if (direction === 0 || direction * left <= 0) {
      break;
    }
    if (Math.abs(odometer - lastOdometer) >= 1) {
      lastOdometer = odometer;
      lastProgressAt = Date.now();
    } else if (Date.now() - lastProgressAt > stallMs) {
      reason = "stalled";
      break;
    }
    const lookahead = (Math.abs(velocity) * steerLookaheadMs) / 1000;
    const nextSteer = steerAt(odometer + direction * lookahead);
    if (Number.isNaN(steer) || Math.abs(nextSteer - steer) >= STEER_UPDATE_DEGREES) {
      steer = nextSteer;
      car.steerTo(steer);
    }
    const nextPower = direction * (Math.abs(left) < slowZoneDegrees ? Math.min(slowSpeed, maxSpeed) : maxSpeed);
    if (nextPower !== power) {
      power = nextPower;
      car.drive(power);
    }
    await sleep(LOOP_MS);
  }

  car.brakeDrive();
  await sleep(BRAKE_SETTLE_MS);
  return reason;
};

const followRun = async (
  car: Car,
  config: Config,
  points: PathPoint[],
  run: Run,
  isCancelled: () => boolean,
): Promise<{ reached: number; reason: StopReason }> => {
  const { speed, slowSpeed, steerTimeoutMs, toleranceDegrees } = config.returnHome;
  let reached = run.from;
  const steerAt = (odometer: number): number => {
    while (reached > run.to && run.direction * (points[reached - 1].odometer - odometer) <= 0) {
      reached -= 1;
    }
    return points[Math.max(reached - 1, run.to)].steerAngle;
  };

  await waitForSteer(car, points[run.from - 1].steerAngle, steerTimeoutMs, isCancelled);
  const target = points[run.to].odometer;
  let reason = await driveTo(car, config, target, speed, steerAt, isCancelled);

  for (let attempt = 0; attempt < CORRECTION_ATTEMPTS && reason === "done"; attempt += 1) {
    if (Math.abs(target - car.driveDegrees()) <= toleranceDegrees) {
      break;
    }
    reason = await driveTo(car, config, target, slowSpeed, steerAt, isCancelled);
  }
  steerAt(car.driveDegrees());
  return { reached: reason === "done" ? run.to : reached, reason };
};

export const pathLength = (path: PathPoint[]): number =>
  path.reduce((sum, point, index) => (index === 0 ? sum : sum + Math.abs(point.odometer - path[index - 1].odometer)), 0);

const withCm = (degrees: number, config: Config): string => {
  const rounded = `${Math.round(degrees)}°`;
  if (config.wheelDiameterMm <= 0) {
    return rounded;
  }
  const cm = (degrees / 360) * Math.PI * (config.wheelDiameterMm / 10);
  return `${rounded} (${cm.toFixed(1)} cm)`;
};

export const returnHome = async (
  car: Car,
  config: Config,
  path: PathPoint[],
  isCancelled: () => boolean,
  label: string,
): Promise<ReturnResult> => {
  const startedAt = Date.now();
  const length = pathLength(path);
  let runs = 0;
  log(`${label}: ${path.length} точок шляху, ${withCm(length, config)} коліс`);
  let index = path.length - 1;

  while (true) {
    const run = findRun(path, index);
    if (!run) {
      break;
    }
    const distance = Math.round(path[run.to].odometer - car.driveDegrees());
    runs += 1;
    log(`${label}: ${run.direction > 0 ? "вперед" : "назад"} ${Math.abs(distance)}° коліс (точки ${run.from}→${run.to})`);
    const { reached, reason } = await followRun(car, config, path, run, isCancelled);
    if (reason !== "done") {
      const current = { odometer: car.driveDegrees(), steerAngle: car.steerAngle() ?? 0 };
      return { remaining: [...path.slice(0, reached), current], reason };
    }
    const error = Math.round(car.driveDegrees() - path[run.to].odometer);
    if (error !== 0) {
      log(`${label}: кінець прогону з похибкою ${error}°`);
    }
    index = run.to;
  }

  car.steerTo(0);
  const finalError = car.driveDegrees() - path[0].odometer;
  log(
    `${label} done: path length ${withCm(length, config)} wheel, runs ${runs}, final error ${withCm(finalError, config)}, ${Date.now() - startedAt} ms`,
  );
  return { remaining: [{ odometer: car.driveDegrees(), steerAngle: 0 }], reason: "home" };
};

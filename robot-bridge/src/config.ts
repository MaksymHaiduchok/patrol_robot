export type SteerSide = "left" | "right";

export type Config = {
  apiWsUrl: string;
  robotId: string;
  drivePorts: string[];
  driveInvertedPorts: string[];
  steerPort: string;
  steerInverted: boolean;
  steerLimitPercent: number;
  steerSpeed: number;
  steerCalibrationPower: number;
  watchdogSeconds: number;
  telemetryIntervalMs: number;
  hide: {
    backSpeed: number;
    backMs: number;
    turnSide: SteerSide;
    turnSpeed: number;
    turnMs: number;
    forwardSpeed: number;
    forwardMs: number;
  };
  returnHome: {
    speed: number;
    slowSpeed: number;
    slowZoneDegrees: number;
    steerTimeoutMs: number;
    stallMs: number;
    toleranceDegrees: number;
    steerLookaheadDegrees: number;
  };
};

const PORT_NAMES = ["A", "B", "C", "D"];

const readString = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Змінна ${name} не задана`);
  }
  return value;
};

const readNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Змінна ${name} має бути числом, отримано "${raw}"`);
  }
  return value;
};

const readBoolean = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  return raw === "true";
};

const readPorts = (name: string, fallback: string): string[] => {
  const ports = (process.env[name] ?? fallback)
    .split(",")
    .map((port) => port.trim().toUpperCase())
    .filter((port) => port !== "");
  for (const port of ports) {
    if (!PORT_NAMES.includes(port)) {
      throw new Error(`Змінна ${name}: невідомий порт "${port}", допустимі ${PORT_NAMES.join(", ")}`);
    }
  }
  return ports;
};

const readSinglePort = (name: string, fallback: string): string => {
  const ports = readPorts(name, fallback);
  if (ports.length !== 1) {
    throw new Error(`Змінна ${name} має містити рівно один порт`);
  }
  return ports[0];
};

const readSide =(name: string, fallback: SteerSide): SteerSide => {
  const value = readString(name, fallback);
  if (value !== "left" && value !== "right") {
    throw new Error(`Змінна ${name} має бути left або right, отримано "${value}"`);
  }
  return value;
};

export const loadConfig = (): Config => ({
  apiWsUrl: readString("API_WS_URL", "ws://localhost:4000/robot"),
  robotId: readString("ROBOT_ID", "lego-audi-01"),
  drivePorts: readPorts("DRIVE_PORTS", "A,B"),
  driveInvertedPorts: readPorts("DRIVE_INVERTED_PORTS", ""),
  steerPort: readSinglePort("STEER_PORT", "D"),
  steerInverted: readBoolean("STEER_INVERTED", false),
  steerLimitPercent: readNumber("STEER_LIMIT_PERCENT", 90),
  steerSpeed: readNumber("STEER_SPEED", 50),
  steerCalibrationPower: readNumber("STEER_CALIBRATION_POWER", 40),
  watchdogSeconds: readNumber("WATCHDOG_SECONDS", 2),
  telemetryIntervalMs: readNumber("TELEMETRY_INTERVAL_MS", 300),
  hide: {
    backSpeed: readNumber("HIDE_BACK_SPEED", 50),
    backMs: readNumber("HIDE_BACK_MS", 1500),
    turnSide: readSide("HIDE_TURN_SIDE", "left"),
    turnSpeed: readNumber("HIDE_TURN_SPEED", 40),
    turnMs: readNumber("HIDE_TURN_MS", 1500),
    forwardSpeed: readNumber("HIDE_FORWARD_SPEED", 50),
    forwardMs: readNumber("HIDE_FORWARD_MS", 1500),
  },
  returnHome: {
    speed: readNumber("RETURN_SPEED", 40),
    slowSpeed: readNumber("RETURN_SLOW_SPEED", 20),
    slowZoneDegrees: readNumber("RETURN_SLOW_ZONE_DEGREES", 120),
    steerTimeoutMs: readNumber("RETURN_STEER_TIMEOUT_MS", 1500),
    stallMs: readNumber("RETURN_STALL_MS", 1500),
    toleranceDegrees: readNumber("RETURN_TOLERANCE_DEGREES", 10),
    steerLookaheadDegrees: readNumber("RETURN_STEER_LOOKAHEAD_DEGREES", 45),
  },
});

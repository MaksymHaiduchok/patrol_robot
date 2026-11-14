import { BasicMotor, PoweredUP, TachoMotor, type BaseHub } from "node-poweredup";
import type { Config, SteerSide } from "./config.js";
import { log, sleep } from "./log.js";
import type { HubStatus } from "./protocol.js";

const DEVICE_WAIT_MS = 5000;
const PORT_OUTPUT_COMMAND = 0x81;
const EXECUTE_IMMEDIATELY_NO_FEEDBACK = 0x10;
const WRITE_DIRECT_MODE_DATA = 0x51;
const GOTO_ABSOLUTE_POSITION = 0x0d;
const POWER_MODE = 0x00;
const BRAKE_POWER = 127;
const FLOAT_POWER = 0;
const HOLD_END_STATE = 126;
const MAX_POWER = 100;
const NO_PROFILE = 0;
const STALL_START_MS = 300;
const STALL_CHECK_MS = 100;
const STALL_TOLERANCE_DEGREES = 2;
const STALL_TIMEOUT_MS = 3000;

type DriveMotor = {
  port: string;
  motor: TachoMotor;
  sign: number;
};

type RotateEvent = {
  degrees: number;
};

type SteerCalibration = {
  center: number;
  limit: number;
};

export type MotorReadings = {
  drive: { port: string; degrees: number }[];
  steer: number | null;
};

export class Car {
  private readonly poweredUP = new PoweredUP();
  private hub: BaseHub | null = null;
  private driveMotors: DriveMotor[] = [];
  private steerMotor: TachoMotor | null = null;
  private steerCalibration: SteerCalibration | null = null;
  private connected = false;
  private readonly degrees = new Map<string, number>();

  constructor(private readonly config: Config) {}

  get status(): HubStatus {
    return this.connected ? "online" : "offline";
  }

  get battery(): number | null {
    return this.connected && this.hub ? this.hub.batteryLevel : null;
  }

  get steerLimit(): number | null {
    return this.steerCalibration?.limit ?? null;
  }

  async start(): Promise<void> {
    this.poweredUP.on("discover", (hub: BaseHub) => {
      if (this.hub) {
        return;
      }
      this.attach(hub).catch((error: unknown) => {
        log(`Хаб: не вдалося підключитись: ${error instanceof Error ? error.message : String(error)}`);
        this.detach();
      });
    });
    log("Хаб: шукаю Technic Hub по Bluetooth...");
    await this.poweredUP.scan();
  }

  readings(): MotorReadings {
    const steerDegrees = this.degrees.get(this.config.steerPort);
    const steerSign = this.config.steerInverted ? -1 : 1;
    return {
      drive: this.driveMotors.map(({ port, sign }) => ({ port, degrees: sign * (this.degrees.get(port) ?? 0) })),
      steer:
        this.steerCalibration && steerDegrees !== undefined
          ? steerSign * (steerDegrees - this.steerCalibration.center)
          : null,
    };
  }

  drive(power: number): void {
    for (const { motor, sign } of this.driveMotors) {
      this.writePower(motor, sign * power);
    }
  }

  steer(side: SteerSide | null): void {
    if (!this.steerMotor || !this.steerCalibration) {
      return;
    }
    const { center, limit } = this.steerCalibration;
    const direction = side === null ? 0 : side === "left" ? -1 : 1;
    const sign = this.config.steerInverted ? -1 : 1;
    this.writeGotoPosition(this.steerMotor, center + direction * sign * limit, this.config.steerSpeed);
  }

  brakeDrive(): void {
    for (const { motor } of this.driveMotors) {
      this.writePower(motor, BRAKE_POWER);
    }
  }

  stop(): void {
    this.brakeDrive();
    this.steer(null);
  }

  private async attach(hub: BaseHub): Promise<void> {
    this.hub = hub;
    this.poweredUP.stop();
    log(`Хаб: знайдено ${hub.name}, підключаюсь...`);
    hub.on("disconnect", () => {
      log("Хаб: зв'язок втрачено, шукаю знову");
      this.detach();
    });
    await hub.connect();

    this.driveMotors = [];
    for (const port of this.config.drivePorts) {
      const motor = await this.waitForDevice(hub, port);
      if (motor instanceof TachoMotor) {
        const sign = this.config.driveInvertedPorts.includes(port) ? -1 : 1;
        this.driveMotors.push({ port, motor, sign });
        this.trackRotation(port, motor);
      } else {
        log(`Хаб: на порту ${port} немає ходового мотора з енкодером`);
      }
    }

    const steerMotor = await this.waitForDevice(hub, this.config.steerPort);
    if (steerMotor instanceof TachoMotor) {
      this.steerMotor = steerMotor;
      this.trackRotation(this.config.steerPort, steerMotor);
      this.steerCalibration = await this.calibrateSteering(steerMotor);
    } else {
      log(`Хаб: на порту ${this.config.steerPort} немає мотора керма з енкодером`);
    }

    this.connected = true;
    const drivePorts = this.driveMotors.map(({ port }) => port).join(",") || "—";
    const steerPort = this.steerMotor ? this.config.steerPort : "—";
    log(`Хаб: підключено, батарея ${hub.batteryLevel}%, хід ${drivePorts}, кермо ${steerPort}`);
  }

  private async calibrateSteering(motor: TachoMotor): Promise<SteerCalibration | null> {
    log("Кермо: калібрування, шукаю упори...");
    const left = await this.findStop(motor, -1);
    const right = await this.findStop(motor, 1);
    if (left === null || right === null || right - left < STALL_TOLERANCE_DEGREES * 4) {
      log("Кермо: не вдалося знайти упори, кермо вимкнено");
      return null;
    }
    const center = Math.round((left + right) / 2);
    const limit = Math.round(((right - left) / 2) * (this.config.steerLimitPercent / 100));
    this.writeGotoPosition(motor, center, this.config.steerSpeed);
    log(`Кермо: упори ${left}° і ${right}°, центр ${center}°, робочий кут ±${limit}°`);
    return { center, limit };
  }

  private async findStop(motor: TachoMotor, direction: number): Promise<number | null> {
    this.writePower(motor, direction * this.config.steerCalibrationPower);
    await sleep(STALL_START_MS);
    const startedAt = Date.now();
    let previous = this.degrees.get(this.config.steerPort);
    while (Date.now() - startedAt < STALL_TIMEOUT_MS) {
      await sleep(STALL_CHECK_MS);
      const current = this.degrees.get(this.config.steerPort);
      if (current !== undefined && previous !== undefined && Math.abs(current - previous) <= STALL_TOLERANCE_DEGREES) {
        this.writePower(motor, FLOAT_POWER);
        return current;
      }
      previous = current;
    }
    this.writePower(motor, FLOAT_POWER);
    return null;
  }

  private writePower(motor: BasicMotor, power: number): void {
    const value = power === BRAKE_POWER ? BRAKE_POWER : Math.max(-100, Math.min(100, Math.round(power)));
    const data = Buffer.from([PORT_OUTPUT_COMMAND, motor.portId, EXECUTE_IMMEDIATELY_NO_FEEDBACK, WRITE_DIRECT_MODE_DATA, POWER_MODE, 0]);
    data.writeInt8(value, 5);
    this.sendRaw(motor, data);
  }

  private writeGotoPosition(motor: BasicMotor, position: number, speed: number): void {
    const data = Buffer.from([
      PORT_OUTPUT_COMMAND,
      motor.portId,
      EXECUTE_IMMEDIATELY_NO_FEEDBACK,
      GOTO_ABSOLUTE_POSITION,
      0,
      0,
      0,
      0,
      speed,
      MAX_POWER,
      HOLD_END_STATE,
      NO_PROFILE,
    ]);
    data.writeInt32LE(Math.round(position), 4);
    this.sendRaw(motor, data);
  }

  private sendRaw(motor: BasicMotor, data: Buffer): void {
    motor.send(data).catch((error: unknown) => {
      log(`Хаб: команда на порт ${motor.portName} не відправлена: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private detach(): void {
    if (!this.hub) {
      return;
    }
    this.hub = null;
    this.connected = false;
    this.driveMotors = [];
    this.steerMotor = null;
    this.steerCalibration = null;
    this.degrees.clear();
    void this.poweredUP.scan();
  }

  private trackRotation(port: string, motor: TachoMotor): void {
    motor.on("rotate", ({ degrees }: RotateEvent) => {
      this.degrees.set(port, degrees);
    });
  }

  private async waitForDevice(hub: BaseHub, port: string): Promise<unknown> {
    return Promise.race([hub.waitForDeviceAtPort(port), sleep(DEVICE_WAIT_MS).then(() => null)]);
  }
}

import { AbsoluteMotor, BasicMotor, PoweredUP, TachoMotor, type BaseHub } from "node-poweredup";
import type { Config, SteerSide } from "./config.js";
import { log, sleep } from "./log.js";
import type { HubStatus } from "./protocol.js";

const DEVICE_WAIT_MS = 5000;

type DriveMotor = {
  port: string;
  motor: BasicMotor;
  sign: number;
};

type RotateEvent = {
  degrees: number;
};

export type MotorReadings = {
  drive: { port: string; degrees: number }[];
  steer: number | null;
};

export class Car {
  private readonly poweredUP = new PoweredUP();
  private hub: BaseHub | null = null;
  private driveMotors: DriveMotor[] = [];
  private steerMotor: AbsoluteMotor | null = null;
  private connected = false;
  private readonly degrees = new Map<string, number>();

  constructor(private readonly config: Config) {}

  get status(): HubStatus {
    return this.connected ? "online" : "offline";
  }

  get battery(): number | null {
    return this.connected && this.hub ? this.hub.batteryLevel : null;
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
    const steerSign = this.config.steerInverted ? -1 : 1;
    const steerDegrees = this.degrees.get(this.config.steerPort);
    return {
      drive: this.driveMotors.map(({ port, sign }) => ({ port, degrees: sign * (this.degrees.get(port) ?? 0) })),
      steer: this.steerMotor && steerDegrees !== undefined ? steerSign * steerDegrees : null,
    };
  }

  drive(power: number): void {
    for (const { motor, sign } of this.driveMotors) {
      void motor.setPower(sign * power);
    }
  }

  steer(side: SteerSide | null): void {
    if (!this.steerMotor) {
      return;
    }
    const direction = side === null ? 0 : side === "left" ? -1 : 1;
    const sign = this.config.steerInverted ? -1 : 1;
    void this.steerMotor.gotoAngle(direction * sign * this.config.steerAngle, this.config.steerSpeed);
  }

  stop(): void {
    for (const { motor } of this.driveMotors) {
      void motor.brake();
    }
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
      if (motor instanceof BasicMotor) {
        const sign = this.config.driveInvertedPorts.includes(port) ? -1 : 1;
        this.driveMotors.push({ port, motor, sign });
        this.trackRotation(port, motor);
      } else {
        log(`Хаб: на порту ${port} немає ходового мотора`);
      }
    }

    const steerMotor = await this.waitForDevice(hub, this.config.steerPort);
    if (steerMotor instanceof AbsoluteMotor) {
      this.steerMotor = steerMotor;
      await steerMotor.resetZero();
      this.trackRotation(this.config.steerPort, steerMotor);
    } else {
      log(`Хаб: на порту ${this.config.steerPort} немає мотора керма з енкодером`);
    }

    this.connected = true;
    const drivePorts = this.driveMotors.map(({ port }) => port).join(",") || "—";
    const steerPort = this.steerMotor ? this.config.steerPort : "—";
    log(`Хаб: підключено, батарея ${hub.batteryLevel}%, хід ${drivePorts}, кермо ${steerPort}`);
  }

  private detach(): void {
    if (!this.hub) {
      return;
    }
    this.hub = null;
    this.connected = false;
    this.driveMotors = [];
    this.steerMotor = null;
    this.degrees.clear();
    void this.poweredUP.scan();
  }

  private trackRotation(port: string, motor: BasicMotor): void {
    if (!(motor instanceof TachoMotor)) {
      return;
    }
    motor.on("rotate", ({ degrees }: RotateEvent) => {
      this.degrees.set(port, degrees);
    });
  }

  private async waitForDevice(hub: BaseHub, port: string): Promise<unknown> {
    return Promise.race([hub.waitForDeviceAtPort(port), sleep(DEVICE_WAIT_MS).then(() => null)]);
  }
}

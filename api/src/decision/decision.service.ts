import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type {
  RobotCommand,
  RobotState,
  RobotStatus,
  SystemMode,
  VisionEvent,
} from '../protocol/protocol.js';
import { RobotGateway } from '../robot/robot.gateway.js';

const TIMER_INTERVAL_MS = 1000;
const DEFAULT_RESUME_TIMEOUT_SECONDS = 30;

type ModeListener = (mode: SystemMode) => void;

@Injectable()
export class DecisionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DecisionService.name);
  private readonly modeListeners: ModeListener[] = [];
  private readonly resumeTimeoutMs =
    Number(
      process.env.ALERT_RESUME_TIMEOUT_SECONDS ??
        DEFAULT_RESUME_TIMEOUT_SECONDS,
    ) * 1000;
  private mode: SystemMode = 'PATROL';
  private alertBySystem = false;
  private strangerInVisit = false;
  private lastPersonEventAt = 0;
  private robotState: RobotState = 'IDLE';
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly robotGateway: RobotGateway) {}

  get systemMode(): SystemMode {
    return this.mode;
  }

  onModuleInit(): void {
    this.robotGateway.onStatus((status) => this.onRobotStatus(status));
    this.timer = setInterval(() => this.checkTimeout(), TIMER_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  onModeChange(listener: ModeListener): void {
    this.modeListeners.push(listener);
  }

  setMode(mode: SystemMode): void {
    if (mode === this.mode) {
      return;
    }
    this.logger.log(`system mode ${this.mode} → ${mode}`);
    this.mode = mode;
    this.resetVisit();
    if (mode === 'STATIONARY') {
      this.robotGateway.sendCommand({ type: 'command', cmd: 'stop' });
    }
    for (const listener of this.modeListeners) {
      listener(mode);
    }
  }

  onOperatorControl(): void {
    if (this.alertBySystem) {
      this.logger.log('operator took over, system releases the robot');
    }
    this.resetVisit();
  }

  onVisionEvent(event: VisionEvent, receivedAt: number): void {
    if (this.mode !== 'PATROL') {
      return;
    }
    const robot = this.robotGateway.currentStatus;
    if (!robot.connected) {
      return;
    }
    const patrolling = robot.state === 'PATROL';
    if (!patrolling && !this.alertBySystem) {
      return;
    }

    switch (event.type) {
      case 'person_detected':
        this.lastPersonEventAt = Date.now();
        this.strangerInVisit = false;
        if (patrolling) {
          this.alert(event, receivedAt);
        }
        break;
      case 'stranger_detected':
        this.lastPersonEventAt = Date.now();
        this.strangerInVisit = true;
        if (patrolling) {
          this.alert(event, receivedAt);
        }
        break;
      case 'known_person':
        this.lastPersonEventAt = Date.now();
        if (this.alertBySystem && !this.strangerInVisit) {
          this.resume(event.type, receivedAt, event.ts);
        }
        break;
      case 'person_left':
        this.lastPersonEventAt = Date.now();
        this.strangerInVisit = false;
        break;
    }
  }

  private alert(event: VisionEvent, receivedAt: number): void {
    this.alertBySystem = true;
    this.send(
      { type: 'command', cmd: 'alert' },
      event.type,
      receivedAt,
      event.ts,
    );
  }

  private resume(reason: string, receivedAt: number, ts: number): void {
    this.alertBySystem = false;
    this.strangerInVisit = false;
    this.send({ type: 'command', cmd: 'resume' }, reason, receivedAt, ts);
  }

  private send(
    command: RobotCommand,
    reason: string,
    receivedAt: number,
    ts: number,
  ): void {
    this.robotGateway.sendCommand(command);
    this.logger.log(
      `decision ${reason} → ${command.cmd} in ${Date.now() - receivedAt} ms (vision→api ${receivedAt - ts} ms)`,
    );
  }

  private checkTimeout(): void {
    if (
      !this.alertBySystem ||
      Date.now() - this.lastPersonEventAt < this.resumeTimeoutMs
    ) {
      return;
    }
    const now = Date.now();
    this.resume('timeout', now, now);
  }

  private onRobotStatus(status: RobotStatus): void {
    const leftAlert = this.robotState === 'ALERT' && status.state !== 'ALERT';
    this.robotState = status.state;
    if (this.alertBySystem && (!status.connected || leftAlert)) {
      this.resetVisit();
    }
  }

  private resetVisit(): void {
    this.alertBySystem = false;
    this.strangerInVisit = false;
  }
}

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { DecisionService } from '../decision/decision.service.js';
import type {
  NavigationMode,
  ObstacleZones,
  RobotCommand,
  RobotDirection,
  SteerDirection,
  VisionObstacles,
} from '../protocol/protocol.js';
import { RobotGateway } from '../robot/robot.gateway.js';
import { VisionService } from '../vision/vision.service.js';

type Phase = 'forward' | 'reverse' | 'turn';

type Side = 'left' | 'right';

type ModeListener = (mode: NavigationMode) => void;

const STALL_MIN_DEGREES = 20;

const readNumber = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== '' ? value : fallback;
};

const opposite = (side: Side): Side => (side === 'left' ? 'right' : 'left');

const formatZones = (zones: ObstacleZones): string =>
  `L ${zones.left.toFixed(2)} C ${zones.center.toFixed(2)} R ${zones.right.toFixed(2)}`;

@Injectable()
export class NavigationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NavigationService.name);
  private readonly listeners: ModeListener[] = [];
  private readonly speed = readNumber('NAV_SPEED', 25);
  private readonly reverseMs = readNumber('NAV_REVERSE_MS', 1200);
  private readonly turnMs = readNumber('NAV_TURN_MS', 1500);
  private readonly pollMs = readNumber('NAV_POLL_MS', 100);
  private readonly staleMs = readNumber('NAV_STALE_MS', 700);
  private readonly stallMs = readNumber('NAV_STALL_MS', 1500);
  private readonly nearConfirm = readNumber('NAV_NEAR_CONFIRM', 3);
  private mode: NavigationMode = 'ROUTE';
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;
  private paused = false;
  private active = false;
  private phase: Phase = 'forward';
  private phaseUntil = 0;
  private turnSide: Side = 'left';
  private drive: RobotDirection | null = null;
  private steer: SteerDirection | null = null;
  private lastOdometer: number | null = null;
  private lastProgressAt = 0;
  private nearStreak = 0;
  private lastFrameId = -1;

  constructor(
    private readonly robotGateway: RobotGateway,
    private readonly decision: DecisionService,
    private readonly vision: VisionService,
  ) {}

  get navigationMode(): NavigationMode {
    return this.mode;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.pollMs);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  onModeChange(listener: ModeListener): void {
    this.listeners.push(listener);
  }

  setMode(mode: NavigationMode): void {
    if (mode === this.mode) {
      return;
    }
    this.logger.log(`navigation ${this.mode} → ${mode}`);
    this.release(true);
    this.paused = false;
    this.mode = mode;
    this.robotGateway.sendCommand({ type: 'command', cmd: 'navigation', mode });
    for (const listener of this.listeners) {
      listener(mode);
    }
  }

  onOperatorCommand(command: RobotCommand): void {
    if (command.cmd === 'resume' || command.cmd === 'set_state') {
      this.paused = false;
      return;
    }
    if (command.cmd === 'set_home') {
      return;
    }
    if (this.mode === 'FREE' && !this.paused && this.active) {
      this.logger.log(`free patrol paused by operator (${command.cmd})`);
    }
    this.paused = true;
    this.release(false);
  }

  private canDrive(): boolean {
    const robot = this.robotGateway.currentStatus;
    return (
      this.mode === 'FREE' &&
      !this.paused &&
      this.decision.systemMode === 'PATROL' &&
      robot.connected &&
      robot.hub === 'online' &&
      robot.state === 'PATROL' &&
      robot.home !== 'returning'
    );
  }

  private async tick(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    try {
      await this.step();
    } finally {
      this.busy = false;
    }
  }

  private async step(): Promise<void> {
    if (!this.canDrive()) {
      this.release(false);
      return;
    }
    const obstacles = await this.vision.obstacles();
    if (!this.canDrive()) {
      this.release(false);
      return;
    }
    if (!obstacles || obstacles.age_ms > this.staleMs) {
      if (this.drive) {
        this.logger.warn('navigation: no fresh depth from vision, braking');
      }
      this.brake();
      return;
    }
    const now = Date.now();
    if (!this.active) {
      this.active = true;
      this.phase = 'forward';
      this.lastProgressAt = now;
      this.lastOdometer = this.robotGateway.odometer.degrees;
      this.logger.log(`free patrol started (${formatZones(obstacles.zones)})`);
    }
    if (obstacles.frame_id !== this.lastFrameId) {
      this.lastFrameId = obstacles.frame_id;
      this.nearStreak = obstacles.near.center ? this.nearStreak + 1 : 0;
    }
    const blockedAhead = this.nearStreak >= this.nearConfirm;
    this.trackProgress(now);
    this.advancePhase(now, obstacles);

    if (this.phase === 'reverse') {
      this.apply('backward', opposite(this.turnSide));
      return;
    }
    if (blockedAhead) {
      this.startReverse(now, obstacles, 'obstacle ahead');
      this.apply('backward', opposite(this.turnSide));
      return;
    }
    if (this.phase === 'turn') {
      this.apply('forward', this.turnSide);
      return;
    }
    const { left, right } = obstacles.near;
    this.apply(
      'forward',
      left && !right ? 'right' : right && !left ? 'left' : 'center',
    );
  }

  private trackProgress(now: number): void {
    const odometer = this.robotGateway.odometer.degrees;
    if (
      this.drive === null ||
      odometer === null ||
      this.lastOdometer === null ||
      Math.abs(odometer - this.lastOdometer) >= STALL_MIN_DEGREES
    ) {
      this.lastOdometer = odometer;
      this.lastProgressAt = now;
    }
  }

  private advancePhase(now: number, obstacles: VisionObstacles): void {
    if (this.phase === 'forward' && now - this.lastProgressAt > this.stallMs) {
      this.startReverse(now, obstacles, 'wheels stalled (bump?)');
      return;
    }
    if (this.phase === 'reverse' && now >= this.phaseUntil) {
      this.phase = 'turn';
      this.phaseUntil = now + this.turnMs;
      this.lastProgressAt = now;
      this.logger.log(`navigation: turning ${this.turnSide}`);
      return;
    }
    if (this.phase === 'turn' && now >= this.phaseUntil) {
      this.phase = 'forward';
      this.lastProgressAt = now;
      this.logger.log('navigation: forward');
    }
  }

  private startReverse(
    now: number,
    obstacles: VisionObstacles,
    reason: string,
  ): void {
    const { zones } = obstacles;
    this.turnSide = zones.left <= zones.right ? 'left' : 'right';
    this.phase = 'reverse';
    this.nearStreak = 0;
    this.phaseUntil = now + this.reverseMs;
    this.lastProgressAt = now;
    this.logger.log(
      `navigation: ${reason} (${formatZones(zones)}) → reverse, then ${this.turnSide}`,
    );
  }

  private apply(drive: RobotDirection, steer: SteerDirection): void {
    if (steer !== this.steer) {
      this.steer = steer;
      this.robotGateway.sendCommand({
        type: 'command',
        cmd: 'steer',
        dir: steer,
      });
    }
    if (drive !== this.drive) {
      this.drive = drive;
      this.robotGateway.sendCommand({
        type: 'command',
        cmd: 'move',
        dir: drive,
        speed: this.speed,
      });
    }
  }

  private brake(): void {
    if (this.drive === null) {
      return;
    }
    this.drive = null;
    this.robotGateway.sendCommand({
      type: 'command',
      cmd: 'move',
      dir: 'forward',
      speed: 0,
    });
  }

  private release(sendStop: boolean): void {
    if (!this.active) {
      return;
    }
    if (sendStop) {
      this.robotGateway.sendCommand({ type: 'command', cmd: 'stop' });
    }
    this.active = false;
    this.drive = null;
    this.steer = null;
    this.phase = 'forward';
    this.logger.log('free patrol paused');
  }
}

import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { WebSocket, type RawData } from 'ws';
import type {
  ApiToRobotMessage,
  RobotCommand,
  RobotStatus,
} from '../protocol/protocol.js';
import { decodeMessage, parseRobotMessage } from './robot.validation.js';

const PING_INTERVAL_MS = 1000;

const OFFLINE_STATUS: RobotStatus = {
  robot_id: null,
  connected: false,
  hub: 'offline',
  state: 'IDLE',
  distance_cm: null,
  battery: null,
};

type StatusListener = (status: RobotStatus) => void;

@WebSocketGateway({ path: '/robot' })
export class RobotGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly logger = new Logger(RobotGateway.name);
  private readonly statusListeners: StatusListener[] = [];
  private socket: WebSocket | null = null;
  private status: RobotStatus = OFFLINE_STATUS;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  get currentStatus(): RobotStatus {
    return this.status;
  }

  afterInit(): void {
    this.pingTimer = setInterval(
      () => this.send({ type: 'ping', ts: Date.now() }),
      PING_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    clearInterval(this.pingTimer);
  }

  handleConnection(client: WebSocket): void {
    if (this.socket) {
      this.logger.warn('second robot connection replaces the previous one');
      this.socket.close();
    }
    this.socket = client;
    this.logger.log('robot connected');
    client.on('message', (raw: RawData) => this.handleMessage(raw));
  }

  handleDisconnect(client: WebSocket): void {
    if (client !== this.socket) {
      return;
    }
    this.socket = null;
    this.logger.log(`robot ${this.status.robot_id ?? ''} disconnected`);
    this.updateStatus(OFFLINE_STATUS);
  }

  onStatus(listener: StatusListener): void {
    this.statusListeners.push(listener);
  }

  sendCommand(command: RobotCommand): boolean {
    if (!this.socket) {
      this.logger.warn(`command ${command.cmd} dropped: robot not connected`);
      return false;
    }
    this.logger.log(`→ robot ${JSON.stringify(command)}`);
    this.send(command);
    return true;
  }

  private send(message: ApiToRobotMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private handleMessage(raw: RawData): void {
    const text = decodeMessage(raw);
    const message = parseRobotMessage(text);
    if (!message) {
      this.logger.warn(`invalid message from robot: ${text}`);
      return;
    }

    switch (message.type) {
      case 'hello':
        this.logger.log(`robot hello: ${message.robot_id}`);
        this.updateStatus({
          ...this.status,
          robot_id: message.robot_id,
          connected: true,
        });
        break;
      case 'telemetry':
        this.updateStatus({
          ...this.status,
          connected: true,
          hub: message.hub,
          state: message.state,
          distance_cm: message.distance_cm,
          battery: message.battery,
        });
        break;
      case 'ack':
        this.logger.log(
          `← robot ack ${message.cmd} in ${Date.now() - message.ts} ms`,
        );
        break;
      case 'pong':
        break;
    }
  }

  private updateStatus(next: RobotStatus): void {
    const changed = JSON.stringify(next) !== JSON.stringify(this.status);
    this.status = next;
    if (!changed) {
      return;
    }
    this.logger.log(
      `robot status: connected=${next.connected} hub=${next.hub} state=${next.state} battery=${next.battery ?? '-'}`,
    );
    for (const listener of this.statusListeners) {
      listener(next);
    }
  }
}

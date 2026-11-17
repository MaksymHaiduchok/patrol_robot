import { Logger, type OnModuleInit } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { WebSocket, type RawData, type Server } from 'ws';
import type { OperatorServerMessage } from '../protocol/protocol.js';
import { DecisionService } from '../decision/decision.service.js';
import { RobotGateway } from '../robot/robot.gateway.js';
import { decodeMessage } from '../robot/robot.validation.js';
import { parseOperatorMessage } from './operator.validation.js';

@WebSocketGateway({ path: '/operator' })
export class OperatorGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(OperatorGateway.name);
  private readonly drivingClients = new Set<WebSocket>();

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly robotGateway: RobotGateway,
    private readonly decision: DecisionService,
  ) {}

  onModuleInit(): void {
    this.robotGateway.onStatus((robot) =>
      this.broadcast({ type: 'robot_status', robot }),
    );
    this.decision.onModeChange((mode) =>
      this.broadcast({ type: 'system_mode', mode }),
    );
  }

  handleConnection(client: WebSocket): void {
    this.logger.log(`operator connected, total ${this.server.clients.size}`);
    client.on('message', (raw: RawData) => this.handleMessage(client, raw));
    this.sendTo(client, {
      type: 'robot_status',
      robot: this.robotGateway.currentStatus,
    });
    this.sendTo(client, {
      type: 'system_mode',
      mode: this.decision.systemMode,
    });
  }

  handleDisconnect(client: WebSocket): void {
    this.logger.log(`operator disconnected, total ${this.server.clients.size}`);
    if (this.drivingClients.delete(client)) {
      this.logger.warn('driving operator disconnected, stopping robot');
      this.robotGateway.sendCommand({ type: 'command', cmd: 'stop' });
    }
  }

  broadcast(message: OperatorServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private sendTo(client: WebSocket, message: OperatorServerMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private handleMessage(client: WebSocket, raw: RawData): void {
    const text = decodeMessage(raw);
    const message = parseOperatorMessage(text);
    if (!message) {
      this.logger.warn(`invalid message from operator: ${text}`);
      return;
    }
    if (message.type === 'set_mode') {
      this.decision.setMode(message.mode);
      return;
    }
    const { command } = message;
    if (this.decision.systemMode === 'STATIONARY' && command.cmd !== 'stop') {
      this.logger.warn(`command ${command.cmd} ignored: STATIONARY mode`);
      return;
    }
    this.decision.onOperatorControl();
    if (
      command.cmd === 'move' ||
      command.cmd === 'turn' ||
      command.cmd === 'steer'
    ) {
      this.drivingClients.add(client);
    } else if (command.cmd === 'stop') {
      this.drivingClients.delete(client);
    }
    this.robotGateway.sendCommand(command);
  }
}

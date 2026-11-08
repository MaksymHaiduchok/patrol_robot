import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { WebSocket, type Server } from 'ws';
import type { OperatorServerMessage } from '../protocol/protocol.js';

@WebSocketGateway({ path: '/operator' })
export class OperatorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(OperatorGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  handleConnection(): void {
    this.logger.log(`operator connected, total ${this.server.clients.size}`);
  }

  handleDisconnect(): void {
    this.logger.log(`operator disconnected, total ${this.server.clients.size}`);
  }

  broadcast(message: OperatorServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { TvService } from './tv.service';

const ROOM_CHANNEL_PREFIX = 'tv-room:';

@WebSocketGateway({
  namespace: '/realtime',
  transports: ['websocket'],
})
export class TvRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server!: Server;

  public constructor(private readonly tvService: TvService) {}

  public async handleConnection(client: Socket): Promise<void> {
    const credential = this.readCredential(client);

    try {
      const context = await this.tvService.getContext(credential);
      await client.join(this.roomChannel(context.device.room.id));
      client.data.tvRoomId = context.device.room.id;
    } catch {
      client.disconnect(true);
    }
  }

  public handleDisconnect(client: Socket): void {
    delete client.data.tvRoomId;
  }

  public notifyGuestAssignmentUpdated(roomId: string, payload: unknown): void {
    if (this.server === undefined) return;
    this.server.to(this.roomChannel(roomId)).emit('guest.assignment.updated', payload);
  }

  private readCredential(client: Socket): string | undefined {
    const value = client.handshake.headers['x-device-credential'];
    return Array.isArray(value) ? value[0] : value;
  }

  private roomChannel(roomId: string): string {
    return `${ROOM_CHANNEL_PREFIX}${roomId}`;
  }
}

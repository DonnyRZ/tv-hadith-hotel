import { describe, expect, it, vi } from 'vitest';
import type { Server, Socket } from 'socket.io';

import type { TvContext } from './tv.types';
import { TvRealtimeGateway } from './tv.realtime.gateway';
import type { TvService } from './tv.service';

const context: TvContext = {
  device: {
    id: 'device-1',
    deviceCode: 'device_302',
    room: { id: 'room-302', number: '302' },
  },
  roomStatus: 'OCCUPIED',
  welcome: {
    message: 'Welcome, Ahmad Fauzan',
    guestName: 'Ahmad Fauzan',
    personalized: true,
  },
};

function socket(credential: string | undefined): Socket & {
  join: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} {
  return {
    id: 'socket-1',
    data: {},
    handshake: {
      headers: credential === undefined ? {} : { 'x-device-credential': credential },
    },
    join: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as Socket & {
    join: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
}

describe('TvRealtimeGateway', () => {
  it('authenticates a TV credential and joins only the mapped room channel', async () => {
    const service = {
      getContext: vi.fn().mockResolvedValue(context),
    } as unknown as TvService;
    const gateway = new TvRealtimeGateway(service);
    const client = socket('tv_valid');

    await gateway.handleConnection(client);

    expect(service.getContext).toHaveBeenCalledWith('tv_valid');
    expect(client.join).toHaveBeenCalledWith('tv-room:room-302');
    expect(client.data.tvRoomId).toBe('room-302');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects a missing or invalid device credential', async () => {
    const service = {
      getContext: vi.fn().mockRejectedValue(new Error('DEVICE_UNAUTHORIZED')),
    } as unknown as TvService;
    const gateway = new TvRealtimeGateway(service);
    const client = socket(undefined);

    await gateway.handleConnection(client);

    expect(service.getContext).toHaveBeenCalledWith(undefined);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('emits assignment hints only to the mapped room channel', () => {
    const service = {} as TvService;
    const gateway = new TvRealtimeGateway(service);
    const emit = vi.fn();
    gateway.server = {
      to: vi.fn().mockReturnValue({ emit }),
    } as unknown as Server;
    const payload = { roomId: 'room-302' };

    gateway.notifyGuestAssignmentUpdated('room-302', payload);

    expect(gateway.server.to).toHaveBeenCalledWith('tv-room:room-302');
    expect(emit).toHaveBeenCalledWith('guest.assignment.updated', payload);
  });
});

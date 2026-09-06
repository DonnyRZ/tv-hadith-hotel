import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresTvDeviceRepository } from './postgres-tv-device.repository';
import {
  TvDevicePairingAlreadyUsedError,
  TvDeviceRoomNumberMismatchError,
} from './tv-device.repository';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('PostgreSQL TV pairing persistence and concurrency', () => {
  let repositoryA: PostgresTvDeviceRepository | undefined;
  let repositoryB: PostgresTvDeviceRepository | undefined;
  let cleanupPool: Pool | undefined;
  let roomId = '';
  let roomNumber = '';
  let installationId = '';

  beforeAll(async () => {
    const config = new ConfigService({ DATABASE_URL: databaseUrl, NODE_ENV: 'test' });
    repositoryA = new PostgresTvDeviceRepository(config);
    await repositoryA.list({ page: 1, pageSize: 1 });
    cleanupPool = new Pool({ connectionString: databaseUrl });
    roomId = randomUUID();
    roomNumber = `test-tv-${roomId.slice(0, 8)}`;
    installationId = `test-installation-${roomId}`;
    await cleanupPool.query(
      'INSERT INTO hotel_rooms (id, room_number, floor) VALUES ($1::uuid, $2, $3)',
      [roomId, roomNumber, 99],
    );
  });

  afterAll(async () => {
    await repositoryA?.onModuleDestroy();
    await repositoryB?.onModuleDestroy();
    await cleanupPool?.query('DELETE FROM hotel_tv_devices WHERE installation_id = $1', [
      installationId,
    ]);
    await cleanupPool?.query('DELETE FROM hotel_rooms WHERE id = $1::uuid', [roomId]);
    await cleanupPool?.end();
  });

  it('shares a pending code across repository instances and keeps it after restart', async () => {
    const config = new ConfigService({ DATABASE_URL: databaseUrl, NODE_ENV: 'test' });
    const created = await repositoryA!.createPending(
      {
        installationId,
        appVersion: 'release-test',
        deviceModel: 'Test Android TV',
        androidApiLevel: 36,
      },
      600,
    );
    repositoryB = new PostgresTvDeviceRepository(config);

    await expect(repositoryB.findByPairingCode(created.pairingCode)).resolves.toMatchObject({
      id: created.record.id,
      status: 'PENDING',
    });

    await repositoryB.pair(
      created.record.id,
      { pairingCode: created.pairingCode, roomId, roomNumber },
      new Date().toISOString(),
    );
    await repositoryA!.onModuleDestroy();
    repositoryA = new PostgresTvDeviceRepository(config);

    await expect(repositoryA.findByPairingCode(created.pairingCode)).resolves.toMatchObject({
      id: created.record.id,
      status: 'PAIRED',
      room: { id: roomId, number: roomNumber },
    });
    await expect(
      repositoryA.pair(
        created.record.id,
        { pairingCode: created.pairingCode, roomId, roomNumber },
        new Date().toISOString(),
      ),
    ).rejects.toBeInstanceOf(TvDevicePairingAlreadyUsedError);
  });

  it('rejects a room-number mismatch inside the pairing transaction', async () => {
    const created = await repositoryA!.createPending(
      {
        installationId: `${installationId}-mismatch`,
        appVersion: 'release-test',
        deviceModel: 'Test Android TV',
        androidApiLevel: 36,
      },
      600,
    );

    await expect(
      repositoryA!.pair(
        created.record.id,
        { pairingCode: created.pairingCode, roomId, roomNumber: 'wrong-room-number' },
        new Date().toISOString(),
      ),
    ).rejects.toBeInstanceOf(TvDeviceRoomNumberMismatchError);
  });
});

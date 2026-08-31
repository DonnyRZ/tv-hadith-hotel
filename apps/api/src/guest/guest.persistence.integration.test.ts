import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresGuestQrTokenRepository } from './guest-qr.repository';
import { PostgresMenuRepository } from '../menu/menu.repository';
import { PostgresRequestRepository } from '../requests/request.repository';
import { roomIdForNumber } from '../receptionist/receptionist.types';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('PostgreSQL guest prerequisite persistence', () => {
  let qrRepository: PostgresGuestQrTokenRepository | undefined;
  let menuRepository: PostgresMenuRepository | undefined;
  let requestRepository: PostgresRequestRepository | undefined;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    await requestRepository?.onModuleDestroy();
    await menuRepository?.onModuleDestroy();
    await qrRepository?.onModuleDestroy();
  });

  it('keeps QR, menu, and request records after repository restart', async () => {
    const config = new ConfigService({ DATABASE_URL: databaseUrl, NODE_ENV: 'test' });
    const roomId = roomIdForNumber('201');

    qrRepository = new PostgresGuestQrTokenRepository(config);
    const issuedToken = await qrRepository.issueForRoom(roomId);
    await qrRepository.onModuleDestroy();
    qrRepository = new PostgresGuestQrTokenRepository(config);
    await expect(qrRepository.findActiveByToken(issuedToken.token)).resolves.toMatchObject({
      id: issuedToken.record.id,
      roomId,
      active: true,
    });
    await qrRepository.revokeForRoom(roomId);
    await qrRepository.onModuleDestroy();
    qrRepository = undefined;

    menuRepository = new PostgresMenuRepository(config);
    const menuResult = await menuRepository.listItems({
      units: ['HOUSEKEEPING'],
      includeInactive: false,
      availableOnly: true,
      page: 1,
      pageSize: 1,
    });
    const seededMenuItem = menuResult.items[0];
    if (seededMenuItem === undefined) throw new Error('PostgreSQL Housekeeping seed is empty.');
    expect(seededMenuItem).toMatchObject({ unit: 'HOUSEKEEPING', kind: 'SERVICE' });
    await menuRepository.onModuleDestroy();
    menuRepository = new PostgresMenuRepository(config);
    await expect(menuRepository.findItemById(seededMenuItem.id)).resolves.toMatchObject({
      id: seededMenuItem.id,
      localizedName: seededMenuItem.localizedName,
    });
    await menuRepository.onModuleDestroy();
    menuRepository = undefined;

    requestRepository = new PostgresRequestRepository(config);
    const clientRequestId = randomUUID();
    const guestAssignmentId = randomUUID();
    const createdRequest = await requestRepository.create({
      clientRequestId,
      guestAssignmentId,
      department: 'HOUSEKEEPING',
      unit: 'HOUSEKEEPING',
      room: { id: roomId, number: '201' },
      items: [
        {
          menuItemId: seededMenuItem.id,
          unit: 'HOUSEKEEPING',
          kind: 'SERVICE',
          name: seededMenuItem.name,
          localizedName: seededMenuItem.localizedName,
          quantity: 1,
          note: null,
          unitPrice: null,
          currency: null,
        },
      ],
      guestNote: null,
    });
    await requestRepository.onModuleDestroy();
    requestRepository = new PostgresRequestRepository(config);
    await expect(requestRepository.findById(createdRequest.id)).resolves.toMatchObject({
      id: createdRequest.id,
      clientRequestId,
      guestAssignmentId,
    });
  });
});

import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashGuestAccessToken, PostgresGuestQrTokenRepository } from './guest-qr.repository';
import { roomIdForNumber } from '../receptionist/receptionist.types';

const describeIfDatabase = process.env.DATABASE_URL?.trim() ? describe : describe.skip;

describeIfDatabase('PostgreSQL guest QR token repository', () => {
  let repository: PostgresGuestQrTokenRepository;

  beforeAll(() => {
    repository = new PostgresGuestQrTokenRepository(
      new ConfigService({
        DATABASE_URL: process.env.DATABASE_URL,
        NODE_ENV: 'test',
      }),
    );
  });

  afterAll(async () => {
    await repository.onModuleDestroy();
  });

  it('persists only a hash and supports issue, lookup, and revoke', async () => {
    const issued = await repository.issueForRoom(roomIdForNumber('201'));

    expect(issued.token).toHaveLength(43);
    expect(issued.record.tokenHash).toBe(hashGuestAccessToken(issued.token));
    expect(issued.record.tokenHash).not.toBe(issued.token);

    const found = await repository.findActiveByToken(issued.token);
    expect(found).toMatchObject({
      id: issued.record.id,
      roomId: roomIdForNumber('201'),
      active: true,
    });

    const revoked = await repository.revokeForRoom(roomIdForNumber('201'));
    expect(revoked).toMatchObject({ id: issued.record.id, active: false });
    await expect(repository.findActiveByToken(issued.token)).resolves.toBeNull();
  });
});

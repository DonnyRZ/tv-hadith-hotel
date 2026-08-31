import type { ConfigService } from '@nestjs/config';

export interface GuestDevelopmentFixture {
  roomNumber: string;
  token: string;
}

/**
 * Development-only fixture input. The raw token is supplied through an
 * ignored local environment file and is never committed to source control.
 */
export function readGuestDevelopmentFixture(config: ConfigService): GuestDevelopmentFixture | null {
  if (config.get<string>('NODE_ENV') === 'production') return null;

  const token = config.get<string>('GUEST_DEV_ACCESS_TOKEN')?.trim();
  if (token === undefined || token.length < 32) return null;

  return {
    roomNumber: config.get<string>('GUEST_DEV_ROOM_NUMBER')?.trim() || '201',
    token,
  };
}

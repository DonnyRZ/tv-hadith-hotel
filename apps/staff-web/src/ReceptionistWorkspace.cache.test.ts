import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readReceptionistRoomCache,
  writeReceptionistRoomCache,
  emptyReceptionistFolioSummary,
  type ReceptionistRoomPreview,
} from './ReceptionistWorkspace.helpers';

const rooms: ReceptionistRoomPreview[] = [
  {
    id: 'room-305',
    number: '305',
    floor: 2,
    status: 'OCCUPIED',
    assignmentId: 'assignment-305',
    guestName: 'E2E Guest',
    stayDays: 2,
    folioSummary: emptyReceptionistFolioSummary(),
  },
];

let storage: Map<string, string>;
let originalWindowDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  storage = new Map<string, string>();
  originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    } as unknown as Window,
  });
});

afterEach(() => {
  if (originalWindowDescriptor === undefined) Reflect.deleteProperty(globalThis, 'window');
  else Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
});

describe('Receptionist room session cache', () => {
  it('keeps an empty result as valid cached data and scopes it per staff user', () => {
    writeReceptionistRoomCache('receptionist-a', []);

    expect(readReceptionistRoomCache('receptionist-a')).toEqual([]);
    expect(readReceptionistRoomCache('receptionist-b')).toBeNull();
  });

  it('round-trips room data without sharing it across users', () => {
    writeReceptionistRoomCache('receptionist-a', rooms);

    expect(readReceptionistRoomCache('receptionist-a')).toEqual(rooms);
    expect(readReceptionistRoomCache('receptionist-b')).toBeNull();
  });

  it('ignores malformed cached payloads so live API data remains authoritative', () => {
    const cacheKey = [...storage.keys()][0];
    expect(cacheKey).toBeUndefined();

    writeReceptionistRoomCache('receptionist-a', rooms);
    const storedKey = [...storage.keys()][0];
    expect(storedKey).toBeDefined();
    storage.set(storedKey ?? '', JSON.stringify({ version: 1, rooms: [{ id: 42 }] }));

    expect(readReceptionistRoomCache('receptionist-a')).toBeNull();
  });
});

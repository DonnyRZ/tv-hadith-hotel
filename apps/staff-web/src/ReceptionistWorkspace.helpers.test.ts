import { describe, expect, it } from 'vitest';

import {
  createReceptionistPreviewRooms,
  filterReceptionistRooms,
  floorForReceptionistRoomNumber,
  getReceptionistRoomsForView,
  getReceptionistTotalPages,
  mapReceptionistRoom,
  paginateReceptionistRooms,
  RECEPTIONIST_FLOORS,
  RECEPTIONIST_ROOM_PAGE_SIZE,
} from './ReceptionistWorkspace.helpers';

describe('Receptionist room board helpers', () => {
  it('keeps the confirmed physical floor mapping and exact 114-room inventory', () => {
    expect(RECEPTIONIST_FLOORS).toEqual([
      { floor: 1, firstRoom: 201, lastRoom: 238 },
      { floor: 2, firstRoom: 301, lastRoom: 338 },
      { floor: 3, firstRoom: 401, lastRoom: 438 },
    ]);
    expect(createReceptionistPreviewRooms()).toHaveLength(114);
  });

  it('paginates every guest floor into ten-room pages', () => {
    const rooms = createReceptionistPreviewRooms();
    const floorThreeRooms = rooms.filter((room) => room.floor === 3);

    expect(floorThreeRooms).toHaveLength(38);
    expect(getReceptionistTotalPages(floorThreeRooms.length)).toBe(4);
    expect(paginateReceptionistRooms(floorThreeRooms, 1)).toHaveLength(RECEPTIONIST_ROOM_PAGE_SIZE);
    expect(paginateReceptionistRooms(floorThreeRooms, 4).map((room) => room.number)).toEqual([
      '431',
      '432',
      '433',
      '434',
      '435',
      '436',
      '437',
      '438',
    ]);
  });

  it('filters room numbers without changing the source inventory', () => {
    const rooms = createReceptionistPreviewRooms().filter((room) => room.floor === 2);

    expect(filterReceptionistRooms(rooms, '31').map((room) => room.number)).toEqual([
      '310',
      '311',
      '312',
      '313',
      '314',
      '315',
      '316',
      '317',
      '318',
      '319',
      '331',
    ]);
    expect(filterReceptionistRooms(rooms, '').length).toBe(38);
  });

  it('searches every floor while the active floor remains a browse filter', () => {
    const rooms = createReceptionistPreviewRooms();

    expect(getReceptionistRoomsForView(rooms, 2, '401').map((room) => room.number)).toEqual([
      '401',
    ]);
    expect(getReceptionistRoomsForView(rooms, 2, '').every((room) => room.floor === 2)).toBe(true);
  });

  it('maps API assignment state and guest names into room actions', () => {
    const room = mapReceptionistRoom({
      room: { id: 'room-417', number: '417' },
      roomStatus: 'OCCUPIED',
      activeAssignment: {
        id: 'assignment-417',
        room: { id: 'room-417', number: '417' },
        guestName: 'Ahmad Fauzan',
        stayDays: 3,
        status: 'ACTIVE',
        assignedAt: '2026-08-30T09:00:00.000Z',
        updatedAt: '2026-08-30T09:00:00.000Z',
        checkedOutAt: null,
        assignedBy: { id: 'staff-1', displayName: 'Receptionist', role: null },
      },
    });

    expect(room).toMatchObject({
      floor: 3,
      number: '417',
      status: 'OCCUPIED',
      assignmentId: 'assignment-417',
      guestName: 'Ahmad Fauzan',
      stayDays: 3,
    });
    expect(filterReceptionistRooms(room === null ? [] : [room], 'ahmad')).toHaveLength(1);
    expect(floorForReceptionistRoomNumber('101')).toBeNull();
  });
});

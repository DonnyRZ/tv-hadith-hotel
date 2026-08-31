import { Injectable } from '@nestjs/common';

import type { GuestAssignmentUpdatedEvent } from './receptionist.types';

export const ROOM_ASSIGNMENT_EVENT_BUS = Symbol('ROOM_ASSIGNMENT_EVENT_BUS');

export type RoomAssignmentEventListener = (event: GuestAssignmentUpdatedEvent) => void;

@Injectable()
export class RoomAssignmentEventBus {
  private readonly listeners = new Set<RoomAssignmentEventListener>();

  public subscribe(listener: RoomAssignmentEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public publish(event: GuestAssignmentUpdatedEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Realtime delivery must not make a successful room mutation fail.
      }
    }
  }
}

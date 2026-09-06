import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  StaffBoutiqueCatalogUpdatedEvent,
  StaffRealtimeEvent,
  StaffRealtimeUnit,
} from '@room-service/contracts/realtime-events';

import type { GuestAssignmentUpdatedEvent } from '../receptionist/receptionist.types';
import type { RequestRecord } from '../requests/request.types';
import { StaffRealtimeGateway } from './staff-realtime.gateway';

@Injectable()
export class StaffRealtimePublisher {
  public constructor(private readonly gateway: StaffRealtimeGateway) {}

  public publishRequestCreated(request: RequestRecord): void {
    this.publish({
      eventId: randomUUID(),
      eventType: 'staff.request.created',
      occurredAt: new Date().toISOString(),
      entityId: request.id,
      updatedAt: request.updatedAt,
      unit: request.unit as StaffRealtimeUnit,
      status: 'NEW',
      roomId: request.room.id,
      guestAssignmentId: request.guestAssignmentId,
    });
  }

  public publishRequestUpdated(request: RequestRecord): void {
    this.publish({
      eventId: randomUUID(),
      eventType: 'staff.request.updated',
      occurredAt: new Date().toISOString(),
      entityId: request.id,
      updatedAt: request.updatedAt,
      unit: request.unit as StaffRealtimeUnit,
      status: request.status,
      roomId: request.room.id,
      guestAssignmentId: request.guestAssignmentId,
    });
  }

  public publishRoomUpdated(event: GuestAssignmentUpdatedEvent): void {
    this.publish({
      eventId: randomUUID(),
      eventType: 'staff.room.updated',
      occurredAt: event.occurredAt,
      entityId: event.room.id,
      updatedAt: event.occurredAt,
      roomId: event.room.id,
      roomNumber: event.room.number,
      roomStatus: event.roomStatus,
    });
  }

  public publishBoutiqueCatalogUpdated(
    resource: StaffBoutiqueCatalogUpdatedEvent['resource'],
    action: StaffBoutiqueCatalogUpdatedEvent['action'],
    entityId: string,
    updatedAt: string,
  ): void {
    this.publish({
      eventId: randomUUID(),
      eventType: 'staff.boutique.catalog.updated',
      occurredAt: new Date().toISOString(),
      entityId,
      updatedAt,
      unit: 'BUTIK_INDONESIA',
      resource,
      action,
    });
  }

  public publishBoutiqueInventoryUpdated(variantId: string, updatedAt: string): void {
    this.publish({
      eventId: randomUUID(),
      eventType: 'staff.boutique.inventory.updated',
      occurredAt: new Date().toISOString(),
      entityId: variantId,
      updatedAt,
      unit: 'BUTIK_INDONESIA',
      variantId,
    });
  }

  private publish(event: StaffRealtimeEvent): void {
    try {
      this.gateway.notify(event);
    } catch {
      // Realtime delivery must never make a committed business mutation fail.
    }
  }
}

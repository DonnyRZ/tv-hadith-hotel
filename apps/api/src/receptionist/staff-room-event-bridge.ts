import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { StaffRealtimePublisher } from '../realtime/staff-realtime.publisher';
import { RoomAssignmentEventBus } from './room-assignment-events';

@Injectable()
export class StaffRoomEventBridge implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  public constructor(
    private readonly eventBus: RoomAssignmentEventBus,
    private readonly publisher: StaffRealtimePublisher,
  ) {}

  public onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      this.publisher.publishRoomUpdated(event);
    });
  }

  public onModuleDestroy(): void {
    this.unsubscribe?.();
  }
}

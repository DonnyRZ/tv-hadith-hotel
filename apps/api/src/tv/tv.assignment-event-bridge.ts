import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { RoomAssignmentEventBus } from '../receptionist/room-assignment-events';
import { TvRealtimeGateway } from './tv.realtime.gateway';

@Injectable()
export class TvAssignmentEventBridge implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  public constructor(
    private readonly eventBus: RoomAssignmentEventBus,
    private readonly gateway: TvRealtimeGateway,
  ) {}

  public onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      this.gateway.notifyGuestAssignmentUpdated(event.room.id, event);
    });
  }

  public onModuleDestroy(): void {
    this.unsubscribe?.();
  }
}

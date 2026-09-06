import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { RequestService } from './request.service';

const EXPIRY_INTERVAL_MS = 60_000;

@Injectable()
export class BoutiqueReservationExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BoutiqueReservationExpiryWorker.name);
  private timer?: NodeJS.Timeout;

  public constructor(private readonly requestService: RequestService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.expireReservations();
    }, EXPIRY_INTERVAL_MS);
    this.timer.unref();
  }

  public onModuleDestroy(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }

  private async expireReservations(): Promise<void> {
    try {
      const count = await this.requestService.expireBoutiqueReservations();
      if (count > 0) this.logger.log(`Expired ${count} Butik Indonesia reservation(s).`);
    } catch (error) {
      this.logger.error('Failed to expire Butik Indonesia reservations.', error);
    }
  }
}

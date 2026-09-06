import { Injectable } from '@nestjs/common';

export type RealtimeHealth = 'ok' | 'memory' | 'disabled' | 'unavailable';

@Injectable()
export class RealtimeState {
  private enabled = false;
  private health: RealtimeHealth = 'disabled';

  public configure(enabled: boolean): void {
    this.enabled = enabled;
    this.health = enabled ? 'unavailable' : 'disabled';
  }

  public setHealth(health: RealtimeHealth): void {
    this.health = health;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getHealth(): RealtimeHealth {
    return this.health;
  }
}

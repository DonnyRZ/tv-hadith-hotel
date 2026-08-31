import { Controller, Get, Header } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  @Header('Cache-Control', 'no-store')
  public getHealth() {
    return {
      status: 'ok',
      service: 'room-service-api',
    };
  }
}

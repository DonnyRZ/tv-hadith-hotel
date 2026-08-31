import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Headers,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StaffSessionGuard } from '../auth/guards/staff-session.guard';
import { ClaimTvProvisioningDto } from './dto/claim-tv-provisioning.dto';
import { ListTvDevicesDto } from './dto/list-tv-devices.dto';
import { PairTvDeviceDto } from './dto/pair-tv-device.dto';
import { StartTvProvisioningDto } from './dto/start-tv-provisioning.dto';
import { TvService } from './tv.service';

@Controller('tv')
export class TvController {
  public constructor(private readonly tvService: TvService) {}

  @Post('provisioning/start')
  @HttpCode(HttpStatus.OK)
  public startProvisioning(@Body() input: StartTvProvisioningDto) {
    return this.tvService.startProvisioning(input);
  }

  @Post('provisioning/claim')
  @HttpCode(HttpStatus.OK)
  public claimProvisioning(@Body() input: ClaimTvProvisioningDto) {
    return this.tvService.claimProvisioning(input);
  }

  @Get('context')
  public getContext(@Headers('X-Device-Credential') credential: string | undefined) {
    return this.tvService.getContext(credential);
  }
}

@Controller('receptionist/tv-devices')
@UseGuards(StaffSessionGuard, PermissionsGuard)
@RequirePermissions('receptionist:tv:pair')
export class ReceptionistTvDevicesController {
  public constructor(private readonly tvService: TvService) {}

  @Get()
  public list(@Query() query: ListTvDevicesDto) {
    return this.tvService.listDevices({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
      ...(query.roomId === undefined ? {} : { roomId: query.roomId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
  }

  @Post('pair')
  @HttpCode(HttpStatus.OK)
  public pair(@Body() input: PairTvDeviceDto) {
    return this.tvService.pairDevice(input);
  }

  @Post(':deviceId/revoke')
  @HttpCode(HttpStatus.OK)
  public revoke(@Param('deviceId', new ParseUUIDPipe()) deviceId: string) {
    return this.tvService.revokeDevice(deviceId);
  }

  @Post(':deviceId/reset')
  @HttpCode(HttpStatus.OK)
  public reset(@Param('deviceId', new ParseUUIDPipe()) deviceId: string) {
    return this.tvService.resetDevice(deviceId);
  }
}

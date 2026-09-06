import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Headers,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';

import { ApiException } from '../auth/api-exception';
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

  @Get('update-manifest')
  @Header('Cache-Control', 'no-store')
  public getUpdateManifest() {
    return this.tvService.getUpdateManifest();
  }

  /**
   * Public immutable download surface for TV updates. MinIO stays private;
   * this endpoint only exposes the exact object path allowed by TvService.
   */
  @Get('updates/:objectPrefix/:versionCode/:fileName')
  public async downloadUpdateArtifact(
    @Param('objectPrefix') objectPrefix: string,
    @Param('versionCode') versionCode: string,
    @Param('fileName') fileName: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const object = await this.tvService.readUpdateArtifact({
      objectPrefix,
      versionCode,
      fileName,
      range,
    });
    response.status(object.status);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Accept-Ranges', 'bytes');
    if (object.contentType !== null) response.setHeader('Content-Type', object.contentType);
    if (object.contentLength !== null) response.setHeader('Content-Length', object.contentLength);
    if (object.contentRange !== null) response.setHeader('Content-Range', object.contentRange);
    if (object.body === null) {
      response.end();
      return;
    }
    Readable.fromWeb(object.body as never).pipe(response);
  }

  /**
   * CI-only upload surface. The shared secret is checked in TvService and
   * never appears in responses or logs.
   */
  @Post('update-artifact/:objectPrefix/:versionCode/:fileName')
  @HttpCode(HttpStatus.CREATED)
  public async uploadUpdateArtifact(
    @Param('objectPrefix') objectPrefix: string,
    @Param('versionCode') versionCode: string,
    @Param('fileName') fileName: string,
    @Headers('content-type') contentType: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: Request,
  ) {
    const uploadToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;
    this.tvService.assertUpdateUploadAuthorization(uploadToken);
    const body = await readRawBody(request);
    return this.tvService.uploadUpdateArtifact({
      objectPrefix,
      versionCode,
      fileName,
      contentType: inferTvUpdateContentType(fileName, contentType),
      body,
      uploadToken,
    });
  }
}

const MAX_TV_UPDATE_BYTES = 250 * 1024 * 1024;

async function readRawBody(request: Request): Promise<Buffer> {
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TV_UPDATE_BYTES) {
    throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, {
      code: 'TV_UPDATE_ARTIFACT_SIZE_INVALID',
      message: 'The TV update artifact size is invalid.',
    });
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_TV_UPDATE_BYTES) {
      throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, {
        code: 'TV_UPDATE_ARTIFACT_SIZE_INVALID',
        message: 'The TV update artifact size is invalid.',
      });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

function inferTvUpdateContentType(
  fileName: string,
  requestedContentType: string | undefined,
): string {
  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith('.json')) return 'application/json';
  if (normalizedName.endsWith('.sha256')) return 'text/plain';
  if (normalizedName.endsWith('.apk')) return 'application/vnd.android.package-archive';
  return requestedContentType ?? 'application/octet-stream';
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

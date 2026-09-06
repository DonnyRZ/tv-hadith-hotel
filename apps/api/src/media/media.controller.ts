import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ApiException } from '../auth/api-exception';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireRoles } from '../auth/decorators/require-roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StaffSessionGuard } from '../auth/guards/staff-session.guard';
import { MediaService } from './media.service';
import type { UploadedMediaFile } from './media.types';

@Controller('media')
export class MediaController {
  public constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffSessionGuard, PermissionsGuard, RolesGuard)
  @RequireRoles('BUTIK_INDONESIA')
  @RequirePermissions('media:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  public async upload(@UploadedFile() file?: UploadedMediaFile) {
    if (file === undefined) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'MEDIA_FILE_REQUIRED',
        message: 'An image file is required.',
      });
    }
    return this.mediaService.upload(file);
  }

  @Get(':mediaId')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  public async get(
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
  ): Promise<StreamableFile> {
    const media = await this.mediaService.read(mediaId);
    return new StreamableFile(media.body, { type: media.contentType });
  }
}

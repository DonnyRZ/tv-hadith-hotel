import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import type { TvProvisioningStatus } from '../tv.types';

export class ListTvDevicesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize?: number;

  @IsOptional()
  @IsUUID()
  public roomId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'PAIRED', 'CLAIMED', 'REVOKED'] satisfies TvProvisioningStatus[])
  public status?: TvProvisioningStatus;
}

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { REQUEST_STATUS_CODES, type RequestStatus } from '../../requests/request.types';

export class ListGuestRequestsDto {
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
  @IsIn(REQUEST_STATUS_CODES)
  public status?: RequestStatus;
}

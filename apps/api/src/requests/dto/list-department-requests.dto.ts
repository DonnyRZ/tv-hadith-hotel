import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { UNIT_CODES, type UnitCode } from '../../rbac/rbac.types';
import { REQUEST_STATUS_CODES, type RequestStatus } from '../request.types';

export class ListDepartmentRequestsDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  public room?: string;

  @IsOptional()
  @IsDateString()
  public dateFrom?: string;

  @IsOptional()
  @IsDateString()
  public dateTo?: string;

  @IsOptional()
  @IsIn(UNIT_CODES)
  public unit?: UnitCode;
}

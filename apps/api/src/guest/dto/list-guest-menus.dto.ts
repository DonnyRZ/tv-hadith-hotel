import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { UNIT_CODES, type UnitCode } from '../../rbac/rbac.types';

export class ListGuestMenusDto {
  @IsIn(UNIT_CODES)
  public unit!: UnitCode;

  @IsOptional()
  @IsUUID()
  public categoryId?: string;

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
}

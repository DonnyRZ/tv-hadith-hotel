import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { UNIT_CODES, type UnitCode } from '../../rbac/rbac.types';

function transformBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ListMenuItemsDto {
  @IsOptional()
  @IsIn(UNIT_CODES)
  public unit?: UnitCode;

  @IsOptional()
  @Transform(transformBoolean)
  @IsBoolean()
  public includeInactive?: boolean;

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

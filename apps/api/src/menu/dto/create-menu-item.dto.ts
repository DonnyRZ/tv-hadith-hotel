import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { UNIT_CODES, type UnitCode } from '../../rbac/rbac.types';
import { LocalizedDescriptionDto, LocalizedNameDto } from './localized-text.dto';
import type { MenuItemKind } from '../menu.types';

export class CreateMenuItemDto {
  @IsIn(UNIT_CODES)
  public unit!: UnitCode;

  @IsIn(['PRODUCT', 'SERVICE'])
  public kind!: MenuItemKind;

  @ValidateNested()
  @Type(() => LocalizedNameDto)
  public localizedName!: LocalizedNameDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedDescriptionDto)
  public localizedDescription?: LocalizedDescriptionDto | null;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  public price?: number | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  public currency?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  public durationMinutes?: number | null;

  @IsOptional()
  @IsUUID()
  public imageMediaId?: string | null;

  @IsOptional()
  @IsBoolean()
  public available?: boolean;

  @IsOptional()
  @IsBoolean()
  public quantityAllowed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  public sortOrder?: number;
}

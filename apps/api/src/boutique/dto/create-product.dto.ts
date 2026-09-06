import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { BoutiqueLocalizedTextDto } from './localized-text.dto';
import { CreateBoutiqueVariantDto } from './variant.dto';

export class CreateBoutiqueProductDto {
  @ValidateNested()
  @Type(() => BoutiqueLocalizedTextDto)
  public localizedName!: BoutiqueLocalizedTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoutiqueLocalizedTextDto)
  public localizedDescription?: BoutiqueLocalizedTextDto | null;

  @IsUUID()
  public categoryId!: string;

  @IsOptional()
  @IsUUID()
  public imageMediaId?: string | null;

  @IsOptional()
  @IsBoolean()
  public available?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  public sortOrder?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBoutiqueVariantDto)
  public variants!: CreateBoutiqueVariantDto[];
}

export class UpdateBoutiqueProductDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BoutiqueLocalizedTextDto)
  public localizedName?: BoutiqueLocalizedTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoutiqueLocalizedTextDto)
  public localizedDescription?: BoutiqueLocalizedTextDto | null;

  @IsOptional()
  @IsUUID()
  public categoryId?: string;

  @IsOptional()
  @IsUUID()
  public imageMediaId?: string | null;

  @IsOptional()
  @IsBoolean()
  public available?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  public sortOrder?: number;
}

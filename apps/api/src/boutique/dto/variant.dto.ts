import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { BoutiqueVariantOptionDto } from './variant-option.dto';

export class CreateBoutiqueVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  public sku!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BoutiqueVariantOptionDto)
  public options!: BoutiqueVariantOptionDto[];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public price!: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  public currency!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  public stockOnHand!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  public sortOrder?: number;
}

export class UpdateBoutiqueVariantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  public sku?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BoutiqueVariantOptionDto)
  public options?: BoutiqueVariantOptionDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public price?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  public currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  public sortOrder?: number;
}

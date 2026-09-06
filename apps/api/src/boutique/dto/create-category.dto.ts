import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

import { BoutiqueLocalizedTextDto } from './localized-text.dto';

export class CreateBoutiqueCategoryDto {
  @ValidateNested()
  @Type(() => BoutiqueLocalizedTextDto)
  public localizedName!: BoutiqueLocalizedTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoutiqueLocalizedTextDto)
  public localizedDescription?: BoutiqueLocalizedTextDto | null;

  @IsOptional()
  @IsUUID()
  public imageMediaId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  public sortOrder?: number;
}

export class UpdateBoutiqueCategoryDto {
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
  public imageMediaId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  public sortOrder?: number;
}

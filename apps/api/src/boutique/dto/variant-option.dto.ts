import { IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { BoutiqueLocalizedTextDto } from './localized-text.dto';

export class BoutiqueVariantOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[a-z0-9_-]+$/)
  public code!: string;

  @ValidateNested()
  @Type(() => BoutiqueLocalizedTextDto)
  public label!: BoutiqueLocalizedTextDto;

  @ValidateNested()
  @Type(() => BoutiqueLocalizedTextDto)
  public value!: BoutiqueLocalizedTextDto;
}

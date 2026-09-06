import { IsString, MaxLength, MinLength } from 'class-validator';

export class BoutiqueLocalizedTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public uz!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public ru!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public en!: string;
}

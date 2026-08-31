import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LocalizedNameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  public uz!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  public ru!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  public en!: string;
}

export class LocalizedDescriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  public uz!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  public ru!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  public en!: string;
}

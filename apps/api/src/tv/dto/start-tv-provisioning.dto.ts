import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class StartTvProvisioningDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(128)
  public installationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  public appVersion!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  public deviceModel!: string;

  @IsInt()
  @Min(21)
  @Max(100)
  public androidApiLevel!: number;
}

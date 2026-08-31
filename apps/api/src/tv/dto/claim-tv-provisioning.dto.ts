import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ClaimTvProvisioningDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  @MaxLength(20)
  public pairingCode!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(128)
  public installationId!: string;
}

import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class PairTvDeviceDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  @MaxLength(20)
  public pairingCode!: string;

  @IsUUID()
  public roomId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  public roomNumber!: string;
}

import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

import { MAX_GUEST_STAY_DAYS, MIN_GUEST_STAY_DAYS } from '../receptionist.types';

export class AssignGuestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  public guestName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_GUEST_STAY_DAYS)
  @Max(MAX_GUEST_STAY_DAYS)
  public stayDays!: number;
}

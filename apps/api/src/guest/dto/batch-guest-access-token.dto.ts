import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

import { RECEPTIONIST_ROOM_CATALOG } from '../../receptionist/receptionist.types';

export class BatchGuestAccessTokenDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(RECEPTIONIST_ROOM_CATALOG.length)
  @IsUUID(undefined, { each: true })
  public roomIds!: string[];
}

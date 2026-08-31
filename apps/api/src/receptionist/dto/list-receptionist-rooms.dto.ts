import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { type RoomStatus } from '../receptionist.types';

export class ListReceptionistRoomsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize?: number;

  @IsOptional()
  @IsIn(['VACANT', 'OCCUPIED'])
  public status?: RoomStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  public search?: string;
}

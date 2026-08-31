import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateGuestRequestItemDto {
  @IsUUID()
  public menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  public quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string | null;
}

export class CreateGuestRequestDto {
  @IsUUID()
  public clientRequestId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGuestRequestItemDto)
  public items!: CreateGuestRequestItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public guestNote?: string | null;
}

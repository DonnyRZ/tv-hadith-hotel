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

  @IsOptional()
  @IsUUID()
  public variantId?: string | null;

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

/**
 * A combined guest cart is submitted once and split into one operational
 * request per unit by the guest service.  The item contract intentionally
 * stays identical to the legacy single-unit request endpoint.
 */
export class CreateGuestRequestGroupDto {
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

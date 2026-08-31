import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateStaffUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  public email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  public displayName?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  public roles?: string[];

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}

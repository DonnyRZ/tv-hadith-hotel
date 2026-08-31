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

export class CreateStaffUserDto {
  @IsEmail()
  @MaxLength(320)
  public email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  public displayName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  public roles!: string[];

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  public password!: string;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}

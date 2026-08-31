import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class StaffLoginDto {
  @IsEmail()
  @MinLength(1)
  @MaxLength(320)
  public email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  public password!: string;
}

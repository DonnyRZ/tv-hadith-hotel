import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PERMISSION_CODES } from '../../rbac/rbac.types';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[A-Za-z][A-Za-z0-9_-]*$/)
  public code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  public name!: string;

  @IsString()
  @MaxLength(500)
  public description!: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_CODES, { each: true })
  public permissions!: string[];
}

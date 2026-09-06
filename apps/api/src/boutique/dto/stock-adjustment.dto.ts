import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class StockAdjustmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(-1000000)
  @Max(1000000)
  public delta!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  public reason!: string;
}

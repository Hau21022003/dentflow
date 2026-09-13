import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export const SERVICE_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const MAX_SERVICE_AMOUNT = 2_147_483_647;
export const MAX_SERVICE_DURATION_MINUTES = 32_767;

export class CreateServiceDto {
  @ApiProperty({ maxLength: 100, pattern: SERVICE_CODE_PATTERN.source })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(SERVICE_CODE_PATTERN)
  code: string;

  @ApiProperty({ maxLength: 150 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceGroupId: string;

  @ApiProperty({ minimum: 0, maximum: MAX_SERVICE_AMOUNT })
  @IsInt()
  @Min(0)
  @Max(MAX_SERVICE_AMOUNT)
  amount: number;

  @ApiProperty({ pattern: ISO_CURRENCY_PATTERN.source, example: 'VND' })
  @Trim()
  @IsString()
  @Matches(ISO_CURRENCY_PATTERN)
  currency: string;

  @ApiProperty({ minimum: 1, maximum: MAX_SERVICE_DURATION_MINUTES })
  @IsInt()
  @Min(1)
  @Max(MAX_SERVICE_DURATION_MINUTES)
  durationMinutes: number;
}

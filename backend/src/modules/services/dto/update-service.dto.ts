import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';
import {
  ISO_CURRENCY_PATTERN,
  MAX_SERVICE_AMOUNT,
  MAX_SERVICE_DURATION_MINUTES,
} from './create-service.dto';

@ValidatorConstraint({ name: 'isUndefined', async: false })
class IsUndefinedConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value === undefined;
  }

  defaultMessage(): string {
    return 'This field is immutable.';
  }
}

export class UpdateServiceDto {
  @Validate(IsUndefinedConstraint)
  code?: never;

  @Validate(IsUndefinedConstraint)
  isActive?: never;

  @ApiPropertyOptional({ maxLength: 150 })
  @NormalizeWhitespace()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  serviceGroupId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_SERVICE_AMOUNT })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_SERVICE_AMOUNT)
  amount?: number;

  @ApiPropertyOptional({ pattern: ISO_CURRENCY_PATTERN.source })
  @Trim()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(ISO_CURRENCY_PATTERN)
  currency?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_SERVICE_DURATION_MINUTES,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_SERVICE_DURATION_MINUTES)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Required when amount or currency is included.',
    maxLength: 500,
  })
  @Trim()
  @ValidateIf(
    (object: UpdateServiceDto) =>
      object.amount !== undefined || object.currency !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

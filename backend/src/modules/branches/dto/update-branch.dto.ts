import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

@ValidatorConstraint({ name: 'isUndefined', async: false })
class IsUndefinedConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value === undefined;
  }

  defaultMessage(): string {
    return 'This field is immutable.';
  }
}

export class UpdateBranchDto {
  @Validate(IsUndefinedConstraint)
  slug?: never;

  @Validate(IsUndefinedConstraint)
  status?: never;

  @ApiPropertyOptional({ maxLength: 150 })
  @NormalizeWhitespace()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @NormalizeWhitespace()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @Trim()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @Trim()
  @IsOptional()
  @IsTimeZone()
  @MaxLength(64)
  timezone?: string | null;
}

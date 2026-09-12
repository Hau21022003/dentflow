import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';

@ValidatorConstraint({ name: 'isUndefined', async: false })
class IsUndefinedConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value === undefined;
  }

  defaultMessage(): string {
    return 'This field is immutable.';
  }
}

export class UpdateServiceGroupDto {
  @Validate(IsUndefinedConstraint)
  isActive?: never;

  @ApiPropertyOptional({ maxLength: 100 })
  @NormalizeWhitespace()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}

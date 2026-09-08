import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
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
  MAX_SUBSCRIPTION_PLAN_AMOUNT,
  MAX_SUBSCRIPTION_PLAN_TRIAL_DAYS,
} from './create-subscription-plan.dto';
import { SubscriptionPlanBillingInterval } from '../entities/subscription-plan.entity';

@ValidatorConstraint({ name: 'isUndefined', async: false })
class IsUndefinedConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value === undefined;
  }

  defaultMessage(): string {
    return 'code is immutable.';
  }
}

export class UpdateSubscriptionPlanDto {
  @Validate(IsUndefinedConstraint)
  code?: never;

  @NormalizeWhitespace()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @NormalizeWhitespace()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(SubscriptionPlanBillingInterval)
  billingInterval?: SubscriptionPlanBillingInterval;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_SUBSCRIPTION_PLAN_AMOUNT)
  amount?: number;

  @Trim()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(ISO_CURRENCY_PATTERN)
  currency?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  providerPlanId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SUBSCRIPTION_PLAN_TRIAL_DAYS)
  trialDays?: number | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  entitlements?: Record<string, unknown>;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Required when the availability state changes.',
    maxLength: 500,
  })
  @Trim()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

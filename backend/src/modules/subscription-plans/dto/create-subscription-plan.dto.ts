import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';
import { SubscriptionPlanBillingInterval } from '../entities/subscription-plan.entity';

export const SUBSCRIPTION_PLAN_CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const MAX_SUBSCRIPTION_PLAN_AMOUNT = 2_147_483_647;
export const MAX_SUBSCRIPTION_PLAN_TRIAL_DAYS = 32_767;

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'growth-monthly' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(SUBSCRIPTION_PLAN_CODE_PATTERN)
  code: string;

  @ApiProperty({ example: 'Growth' })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    example: 'For growing dental groups.',
    nullable: true,
  })
  @NormalizeWhitespace()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty({ enum: SubscriptionPlanBillingInterval })
  @IsEnum(SubscriptionPlanBillingInterval)
  billingInterval: SubscriptionPlanBillingInterval;

  @ApiProperty({ example: 250000 })
  @IsInt()
  @Min(0)
  @Max(MAX_SUBSCRIPTION_PLAN_AMOUNT)
  amount: number;

  @ApiProperty({ example: 'VND' })
  @Trim()
  @IsString()
  @Matches(ISO_CURRENCY_PATTERN)
  currency: string;

  @ApiPropertyOptional({ example: 'price_123', nullable: true })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  providerPlanId?: string | null;

  @ApiPropertyOptional({ example: 14, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SUBSCRIPTION_PLAN_TRIAL_DAYS)
  trialDays?: number | null;

  @ApiPropertyOptional({ example: { maxBranches: 3, analytics: true } })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  entitlements?: Record<string, unknown>;
}

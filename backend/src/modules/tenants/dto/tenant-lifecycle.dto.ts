import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { MAX_TENANT_TRIAL_DAYS } from './create-platform-tenant.dto';

export class LifecycleReasonDto {
  @ApiProperty({ maxLength: 500 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class ExtendTenantTrialDto extends LifecycleReasonDto {
  @ApiProperty({ minimum: 1, maximum: MAX_TENANT_TRIAL_DAYS })
  @IsInt()
  @Min(1)
  @Max(MAX_TENANT_TRIAL_DAYS)
  days: number;
}

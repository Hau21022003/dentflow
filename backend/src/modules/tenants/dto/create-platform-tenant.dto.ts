import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export const TENANT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const TENANT_LOCALE_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;
export const MAX_TENANT_TRIAL_DAYS = 32_767;

export class CreatePlatformTenantDto {
  @ApiProperty({ example: 'Nha khoa Tâm Anh LLC' })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName: string;

  @ApiProperty({ example: 'Nha khoa Tâm Anh' })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  displayName: string;

  @ApiProperty({ example: 'tam-anh' })
  @Trim()
  @IsString()
  @Matches(TENANT_SLUG_PATTERN)
  @MaxLength(100)
  slug: string;

  @ApiProperty({ example: 'billing@tam-anh.example.test' })
  @Trim()
  @IsEmail()
  @MaxLength(254)
  billingEmail: string;

  @ApiProperty({ example: 'owner@tam-anh.example.test' })
  @Trim()
  @IsEmail()
  @MaxLength(254)
  ownerEmail: string;

  @ApiProperty({ example: 'Nguyễn Minh Anh' })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  ownerFullName: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  planId: string;

  @ApiPropertyOptional({
    description: 'Overrides the selected plan trial duration for this tenant.',
    minimum: 1,
    maximum: MAX_TENANT_TRIAL_DAYS,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_TENANT_TRIAL_DAYS)
  trialDays?: number;

  @ApiPropertyOptional({ example: 'vi', default: 'vi' })
  @Trim()
  @IsOptional()
  @Matches(TENANT_LOCALE_PATTERN)
  @MaxLength(10)
  defaultLocale?: string;

  @ApiPropertyOptional({ example: 'Asia/Ho_Chi_Minh' })
  @Trim()
  @IsOptional()
  @IsTimeZone()
  @MaxLength(64)
  defaultTimezone?: string;
}

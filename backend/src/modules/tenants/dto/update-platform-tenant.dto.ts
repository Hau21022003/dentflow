import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';
import { TENANT_LOCALE_PATTERN } from './create-platform-tenant.dto';

export class UpdatePlatformTenantDto {
  @ApiPropertyOptional()
  @NormalizeWhitespace()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional()
  @NormalizeWhitespace()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  displayName?: string;

  @ApiPropertyOptional()
  @Trim()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEmail()
  @MaxLength(254)
  billingEmail?: string;

  @ApiPropertyOptional({ nullable: true })
  @Trim()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string | null;

  @ApiPropertyOptional()
  @Trim()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Matches(TENANT_LOCALE_PATTERN)
  @MaxLength(10)
  defaultLocale?: string;

  @ApiPropertyOptional()
  @Trim()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsTimeZone()
  @MaxLength(64)
  defaultTimezone?: string;
}

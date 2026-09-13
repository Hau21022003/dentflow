import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  MaxLength,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export const BRANCH_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateBranchDto {
  @ApiProperty({ maxLength: 100, pattern: BRANCH_SLUG_PATTERN.source })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(BRANCH_SLUG_PATTERN)
  slug: string;

  @ApiProperty({ maxLength: 150 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ maxLength: 500 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiProperty({ maxLength: 30 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @Trim()
  @IsOptional()
  @IsTimeZone()
  @MaxLength(64)
  timezone?: string | null;
}

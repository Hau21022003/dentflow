import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';
import { OperatoryType } from '../entities/operatory.entity';

export class CreateOperatoryDto {
  @ApiProperty({ maxLength: 100 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/)
  code: string;

  @ApiProperty({ maxLength: 150 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: OperatoryType })
  @IsEnum(OperatoryType)
  type: OperatoryType;
}

export class UpdateOperatoryDto {
  @ApiProperty({ maxLength: 150 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: OperatoryType })
  @IsEnum(OperatoryType)
  type: OperatoryType;
}

export class OperatoryReasonDto {
  @ApiProperty({ maxLength: 500 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export enum OperatorySortBy {
  CODE = 'code',
  NAME = 'name',
  TYPE = 'type',
  IS_ACTIVE = 'isActive',
  CREATED_AT = 'createdAt',
}

function parseBoolean(value: unknown): unknown {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class ListOperatoriesQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({ enum: OperatorySortBy })
  @IsOptional()
  @IsEnum(OperatorySortBy)
  declare sortBy?: OperatorySortBy;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }: { value: unknown }) => parseBoolean(value))
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

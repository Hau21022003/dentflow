import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';
import { TenantStatus } from '../entities/tenant.entity';

export enum PlatformTenantSortBy {
  DISPLAY_NAME = 'displayName',
  PLAN_NAME = 'planName',
  BRANCH_COUNT = 'branchCount',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
}

export class ListPlatformTenantsQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Cursor pagination is no longer supported. Use page instead.',
  })
  @IsOptional()
  @IsEmpty()
  cursor?: string;

  @ApiPropertyOptional({
    enum: PlatformTenantSortBy,
    default: PlatformTenantSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(PlatformTenantSortBy)
  declare sortBy?: PlatformTenantSortBy;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  planId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  trialEndingBefore?: string;
}

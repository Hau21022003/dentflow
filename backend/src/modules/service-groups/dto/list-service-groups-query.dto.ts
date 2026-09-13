import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';

export enum ServiceGroupSortBy {
  NAME = 'name',
  CREATED_AT = 'createdAt',
}

function parseBooleanQuery(value: unknown): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class ListServiceGroupsQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({
    enum: ServiceGroupSortBy,
    default: ServiceGroupSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(ServiceGroupSortBy)
  declare sortBy?: ServiceGroupSortBy;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }: { value: unknown }) => parseBooleanQuery(value))
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

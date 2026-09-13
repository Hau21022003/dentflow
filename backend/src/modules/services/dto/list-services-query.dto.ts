import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';

export enum ServiceSortBy {
  CODE = 'code',
  NAME = 'name',
  SERVICE_GROUP_NAME = 'serviceGroupName',
  AMOUNT = 'amount',
  DURATION_MINUTES = 'durationMinutes',
  CREATED_AT = 'createdAt',
}

function parseBooleanQuery(value: unknown): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class ListServicesQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({ enum: ServiceSortBy, default: ServiceSortBy.NAME })
  @IsOptional()
  @IsEnum(ServiceSortBy)
  declare sortBy?: ServiceSortBy;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }: { value: unknown }) => parseBooleanQuery(value))
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

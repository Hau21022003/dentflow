import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';

export enum PatientSortBy {
  FULL_NAME = 'fullName',
  DATE_OF_BIRTH = 'dateOfBirth',
  CREATED_AT = 'createdAt',
}

export class ListPatientsQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({
    enum: PatientSortBy,
    default: PatientSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(PatientSortBy)
  declare sortBy?: PatientSortBy;
}

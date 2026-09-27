import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';

export enum PatientSortBy {
  FULL_NAME = 'fullName',
  DATE_OF_BIRTH = 'dateOfBirth',
  CREATED_AT = 'createdAt',
  NEXT_APPOINTMENT_AT = 'nextAppointmentAt',
  LAST_VISIT_AT = 'lastVisitAt',
}

export enum PatientScheduleFilter {
  WITH_UPCOMING = 'WITH_UPCOMING',
  WITHOUT_UPCOMING = 'WITHOUT_UPCOMING',
}

export class ListPatientsQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({
    enum: PatientSortBy,
    default: PatientSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(PatientSortBy)
  declare sortBy?: PatientSortBy;

  @ApiPropertyOptional({ enum: PatientScheduleFilter })
  @IsOptional()
  @IsEnum(PatientScheduleFilter)
  declare scheduleFilter?: PatientScheduleFilter;
}

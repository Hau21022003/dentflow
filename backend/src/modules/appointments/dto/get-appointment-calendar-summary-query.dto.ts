import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GetAppointmentCalendarSummaryQueryDto {
  @ApiProperty({
    example: '2026-09',
    pattern: YEAR_MONTH_PATTERN.source,
  })
  @IsString()
  @Matches(YEAR_MONTH_PATTERN)
  declare month: string;
}

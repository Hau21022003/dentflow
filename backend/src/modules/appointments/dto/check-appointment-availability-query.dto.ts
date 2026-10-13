import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CheckAppointmentAvailabilityQueryDto {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  startAt: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  endAt: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dentistUserId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  operatoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  excludeAppointmentId?: string;
}

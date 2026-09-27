import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';
import { AppointmentStatus } from '../entities/appointment.entity';

export class ListAppointmentsQueryDto extends PageListQueryDto {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  declare from: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  declare to: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dentistUserId?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { AppointmentSource } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ enum: AppointmentSource })
  @IsEnum(AppointmentSource)
  source: AppointmentSource;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  startAt: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  endAt: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedDentistUserId?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @NormalizeWhitespace()
  @IsString()
  @MaxLength(1000)
  visitReason?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @NormalizeWhitespace()
  @IsString()
  @MaxLength(2000)
  operationalNote?: string | null;
}

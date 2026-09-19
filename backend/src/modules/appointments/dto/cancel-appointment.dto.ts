import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum CancellationReasonCode {
  PATIENT_CANCELLED = 'PATIENT_CANCELLED',
  CLINIC_CANCELLED = 'CLINIC_CANCELLED',
  DUPLICATE_BOOKING = 'DUPLICATE_BOOKING',
}

export class CancelAppointmentDto {
  @ApiProperty({ enum: CancellationReasonCode })
  @IsEnum(CancellationReasonCode)
  reasonCode: CancellationReasonCode;
}

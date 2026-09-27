import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum NoShowReasonCode {
  PATIENT_NO_SHOW = 'PATIENT_NO_SHOW',
}

export class NoShowAppointmentDto {
  @ApiProperty({ enum: NoShowReasonCode })
  @IsEnum(NoShowReasonCode)
  reasonCode: NoShowReasonCode;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import {
  PatientAlertCategory,
  PatientAlertSeverity,
} from '../entities/patient-alert.entity';

export class CreatePatientAlertDto {
  @ApiProperty({ enum: PatientAlertCategory })
  @IsEnum(PatientAlertCategory)
  category: PatientAlertCategory;

  @ApiProperty({ enum: PatientAlertSeverity })
  @IsEnum(PatientAlertSeverity)
  severity: PatientAlertSeverity;

  @ApiProperty({ maxLength: 500 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;
}

export class UpdatePatientAlertDto extends CreatePatientAlertDto {}

export enum ResolvePatientAlertReasonCode {
  NO_LONGER_APPLICABLE = 'NO_LONGER_APPLICABLE',
  ENTERED_IN_ERROR = 'ENTERED_IN_ERROR',
  DUPLICATE = 'DUPLICATE',
}

export class ResolvePatientAlertDto {
  @ApiProperty({ enum: ResolvePatientAlertReasonCode })
  @IsEnum(ResolvePatientAlertReasonCode)
  reasonCode: ResolvePatientAlertReasonCode;
}

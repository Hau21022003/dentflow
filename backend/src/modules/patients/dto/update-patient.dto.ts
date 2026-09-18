import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsNotFutureDate } from '../../../common/dto-decorators/is-not-future-date.decorator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';
import { PatientGender } from '../entities/patient.entity';
import { PatientEmergencyContactDto } from './patient-emergency-contact.dto';

export class UpdatePatientDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @NormalizeWhitespace()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @Trim()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: PatientGender })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(PatientGender)
  gender?: PatientGender;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @Trim()
  @IsOptional()
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({
    type: () => PatientEmergencyContactDto,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PatientEmergencyContactDto)
  emergencyContact?: PatientEmergencyContactDto | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NormalizeWhitespace()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  referralSource?: string | null;
}

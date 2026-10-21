import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PatientFileCategory } from '../entities/patient-file.entity';

export class CreatePatientFileDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  objectKey: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @Matches(/^[^\r\n\t]+$/)
  originalFileName: string;

  @ApiProperty({ enum: PatientFileCategory })
  @IsEnum(PatientFileCategory)
  category: PatientFileCategory;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fileDate: string;
}

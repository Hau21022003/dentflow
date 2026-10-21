import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsString, Min } from 'class-validator';
import {
  BranchFileUploadPurpose,
  PATIENT_FILE_CONTENT_TYPES,
} from '../upload.constants';

export class CreateFileUploadIntentDto {
  @ApiProperty({ enum: BranchFileUploadPurpose })
  @IsEnum(BranchFileUploadPurpose)
  purpose: BranchFileUploadPurpose;

  @ApiProperty({ enum: PATIENT_FILE_CONTENT_TYPES, example: 'application/pdf' })
  @IsString()
  @IsIn(PATIENT_FILE_CONTENT_TYPES)
  contentType: string;

  @ApiProperty({ minimum: 1, example: 1_048_576 })
  @IsInt()
  @Min(1)
  sizeBytes: number;
}

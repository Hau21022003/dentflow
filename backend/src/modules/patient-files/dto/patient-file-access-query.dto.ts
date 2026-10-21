import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum PatientFileDisposition {
  INLINE = 'inline',
  ATTACHMENT = 'attachment',
}

export class PatientFileAccessQueryDto {
  @ApiPropertyOptional({ enum: PatientFileDisposition, default: 'inline' })
  @IsOptional()
  @IsEnum(PatientFileDisposition)
  disposition?: PatientFileDisposition;
}

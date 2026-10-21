import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export class CancelTreatmentPlanDto {
  @ApiProperty({ example: 'PATIENT_REQUEST' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{0,79}$/)
  reasonCode: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf(
    (input: CancelTreatmentPlanDto, value: unknown) =>
      input.reasonCode === 'OTHER' || value !== undefined,
  )
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}

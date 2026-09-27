import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';
import { VISIT_CLINICAL_TEXT_MAX_LENGTH } from './update-visit.dto';

export class CreateTreatmentNoteDto {
  @ApiProperty({ maxLength: VISIT_CLINICAL_TEXT_MAX_LENGTH })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(VISIT_CLINICAL_TEXT_MAX_LENGTH)
  content: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';
import { TreatmentItemEventType } from '../entities/treatment-item-event.entity';
export class RecordTreatmentItemEventDto {
  @ApiProperty({ enum: TreatmentItemEventType })
  @IsIn([
    TreatmentItemEventType.IN_PROGRESS,
    TreatmentItemEventType.COMPLETED,
    TreatmentItemEventType.CANCELLED,
  ])
  eventType: TreatmentItemEventType;
  @ApiPropertyOptional()
  @ValidateIf(
    (dto: RecordTreatmentItemEventDto) =>
      dto.eventType === TreatmentItemEventType.CANCELLED,
  )
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{0,79}$/)
  reasonCode?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf(
    (dto: RecordTreatmentItemEventDto, value: unknown) =>
      dto.eventType === TreatmentItemEventType.CANCELLED &&
      (dto.reasonCode === 'OTHER' || value !== undefined),
  )
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;

  @IsOptional() readonly _unused?: never;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
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
  @IsOptional() readonly _unused?: never;
}

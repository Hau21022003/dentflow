import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
export class TreatmentReasonDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{0,79}$/)
  reasonCode: string;
}

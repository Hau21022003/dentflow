import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TreatmentPlanItemInputDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() id?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() serviceId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10000) quantity: number;
  @ApiProperty() @IsInt() @Min(0) discountAmount: number;
  @ApiProperty({ format: 'uuid' }) @IsUUID() plannedDentistUserId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  toothPosition?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  indication?: string | null;
}

export class SyncTreatmentPlanDto {
  @ApiProperty({ type: [TreatmentPlanItemInputDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TreatmentPlanItemInputDto)
  items: TreatmentPlanItemInputDto[];
}

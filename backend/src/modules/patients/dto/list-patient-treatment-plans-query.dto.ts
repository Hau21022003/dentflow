import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';
import { TreatmentPlanStatus } from '../../treatment-plans/entities/treatment-plan.entity';

export class ListPatientTreatmentPlansQueryDto extends PickType(
  PageListQueryDto,
  ['page', 'search', 'sortOrder'] as const,
) {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: TreatmentPlanStatus })
  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dentistUserId?: string;

  @ApiPropertyOptional({ enum: ['createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt'])
  sortBy?: 'createdAt';
}

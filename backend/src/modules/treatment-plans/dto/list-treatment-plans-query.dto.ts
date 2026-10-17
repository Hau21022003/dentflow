import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';
import { TreatmentPlanStatus } from '../entities/treatment-plan.entity';

export class ListTreatmentPlansQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({ enum: TreatmentPlanStatus })
  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';
import { BranchStatus } from '../entities/branch.entity';

export enum BranchSortBy {
  NAME = 'name',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
}

export class ListBranchesQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({
    enum: BranchSortBy,
    default: BranchSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(BranchSortBy)
  declare sortBy?: BranchSortBy;

  @ApiPropertyOptional({ enum: BranchStatus })
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;
}

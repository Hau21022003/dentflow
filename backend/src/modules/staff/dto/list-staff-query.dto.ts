import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PageListQueryDto } from '../../../common/dto/page-list-query.dto';
import { TenantUserMembershipStatus } from '../entities/tenant-user-membership.entity';

export enum StaffListStatus {
  ACTIVE = TenantUserMembershipStatus.ACTIVE,
  DISABLED = TenantUserMembershipStatus.DISABLED,
  INVITED = 'INVITED',
}

export class ListStaffQueryDto extends PageListQueryDto {
  @ApiPropertyOptional({ enum: StaffListStatus })
  @IsOptional()
  @IsEnum(StaffListStatus)
  status?: StaffListStatus;
}

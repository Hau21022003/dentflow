import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { BranchStaffRoleCodesDto } from './branch-staff-role-codes.dto';

export class GrantBranchStaffRolesDto extends BranchStaffRoleCodesDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @NormalizeWhitespace()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

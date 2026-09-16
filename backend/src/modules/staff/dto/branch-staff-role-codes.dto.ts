import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantRoleCode } from '../../authorization/entities/role-assignment.entity';

const BRANCH_MANAGEABLE_ROLE_CODES = [
  TenantRoleCode.RECEPTIONIST,
  TenantRoleCode.DENTIST,
] as const;

export class BranchStaffRoleCodesDto {
  @ApiProperty({
    enum: BRANCH_MANAGEABLE_ROLE_CODES,
    isArray: true,
    minItems: 1,
    maxItems: BRANCH_MANAGEABLE_ROLE_CODES.length,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BRANCH_MANAGEABLE_ROLE_CODES.length)
  @ArrayUnique()
  @IsIn(BRANCH_MANAGEABLE_ROLE_CODES, { each: true })
  roleCodes: (typeof BRANCH_MANAGEABLE_ROLE_CODES)[number][];
}

export { BRANCH_MANAGEABLE_ROLE_CODES };

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TenantRoleCode } from '../../authorization/entities/role-assignment.entity';

const BRANCH_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ProposedRoleAssignmentDto {
  @ApiProperty({ enum: TenantRoleCode })
  @IsEnum(TenantRoleCode)
  roleCode: TenantRoleCode;

  @ApiPropertyOptional({
    type: [String],
    description: 'Required for branch-scoped roles; omitted for TENANT_ADMIN.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(BRANCH_SLUG_PATTERN, { each: true })
  @MaxLength(100, { each: true })
  branchSlugs?: string[];
}

export class ProposedRoleAssignmentsDto {
  @ApiProperty({ type: [ProposedRoleAssignmentDto], minItems: 1 })
  @IsArray()
  @ArrayUnique((assignment: ProposedRoleAssignmentDto) => assignment.roleCode)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProposedRoleAssignmentDto)
  assignments: ProposedRoleAssignmentDto[];
}

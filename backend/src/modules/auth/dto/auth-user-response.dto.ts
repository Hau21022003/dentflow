import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../authorization/authorization.policy';
import { PlatformRoleCode } from '../../authorization/entities/platform-role-assignment.entity';
import { TenantRoleCode } from '../../authorization/entities/role-assignment.entity';
import { BranchStatus } from '../../branches/entities/branch.entity';
import { TenantStatus } from '../../tenants/entities/tenant.entity';

export class PlatformAuthorizationResponseDto {
  @ApiProperty({ enum: PlatformRoleCode, isArray: true })
  roles: PlatformRoleCode[];

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class AuthorizationTenantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'tam-anh' })
  slug: string;

  @ApiProperty({ example: 'Nha khoa Tâm Anh' })
  displayName: string;

  @ApiProperty({ enum: TenantStatus })
  status: TenantStatus;
}

export class AuthorizationBranchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Chi nhánh Quận 1' })
  name: string;

  @ApiProperty({ enum: BranchStatus })
  status: BranchStatus;
}

export class BranchAuthorizationResponseDto {
  @ApiProperty({ type: AuthorizationBranchResponseDto })
  branch: AuthorizationBranchResponseDto;

  @ApiProperty({ enum: TenantRoleCode, isArray: true })
  roles: TenantRoleCode[];

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];
}

export class TenantAuthorizationResponseDto {
  @ApiProperty({ type: AuthorizationTenantResponseDto })
  tenant: AuthorizationTenantResponseDto;

  @ApiProperty({ enum: TenantRoleCode, isArray: true })
  roles: TenantRoleCode[];

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];

  @ApiProperty({ type: BranchAuthorizationResponseDto, isArray: true })
  branches: BranchAuthorizationResponseDto[];
}

export class AuthorizationSnapshotResponseDto {
  @ApiProperty({ type: PlatformAuthorizationResponseDto })
  platform: PlatformAuthorizationResponseDto;

  @ApiProperty({ type: TenantAuthorizationResponseDto, isArray: true })
  tenants: TenantAuthorizationResponseDto[];
}

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'dentist@example.test' })
  email: string;

  @ApiProperty({ example: 'Bác sĩ Demo' })
  fullName: string;

  @ApiProperty({ type: AuthorizationSnapshotResponseDto })
  authorization: AuthorizationSnapshotResponseDto;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

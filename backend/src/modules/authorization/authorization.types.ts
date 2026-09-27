import type { BranchStatus } from '../branches/entities/branch.entity';
import type { TenantStatus } from '../tenants/entities/tenant.entity';
import type { Permission } from './authorization.policy';
import type { PlatformRoleCode } from './entities/platform-role-assignment.entity';
import type { TenantRoleCode } from './entities/role-assignment.entity';

export interface AuthorizationSnapshot {
  platform: PlatformAuthorizationSnapshot;
  tenants: TenantAuthorizationSnapshot[];
}

export interface EffectiveAuthorizationAccess {
  platformRoles: PlatformRoleCode[];
  tenantRoles: TenantRoleCode[];
  permissions: Permission[];
}

export interface PlatformAuthorizationSnapshot {
  roles: PlatformRoleCode[];
  permissions: Permission[];
}

export interface TenantAuthorizationSnapshot {
  tenant: AuthorizationTenant;
  roles: TenantRoleCode[];
  permissions: Permission[];
  branches: BranchAuthorizationSnapshot[];
}

export interface AuthorizationTenant {
  id: string;
  slug: string;
  displayName: string;
  status: TenantStatus;
}

export interface BranchAuthorizationSnapshot {
  branch: AuthorizationBranch;
  roles: TenantRoleCode[];
  permissions: Permission[];
}

export interface AuthorizationBranch {
  id: string;
  slug: string;
  name: string;
  /** Resolved branch override or tenant default, safe to expose in session data. */
  timezone: string;
  status: BranchStatus;
}

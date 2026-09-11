import { hash } from 'src/common/utils/hash.util';
import {
  PlatformRoleAssignment,
  PlatformRoleCode,
} from 'src/modules/authorization/entities/platform-role-assignment.entity';
import {
  RoleAssignment,
  TenantRoleCode,
} from 'src/modules/authorization/entities/role-assignment.entity';
import {
  Branch,
  BranchStatus,
} from 'src/modules/branches/entities/branch.entity';
import {
  Tenant,
  TenantStatus,
} from 'src/modules/tenants/entities/tenant.entity';
import { User, UserStatus } from 'src/modules/users/entities/user.entity';
import {
  TenantUserMembership,
  TenantUserMembershipStatus,
} from 'src/modules/staff/entities/tenant-user-membership.entity';
import { EntityManager } from 'typeorm';

export interface AuthFixtureOptions {
  manager: EntityManager;
  password: string;
  bcryptSaltRounds: number;
}

export interface CreateUserOptions {
  email?: string;
  fullName?: string;
  status?: UserStatus;
  password?: string;
  passwordChangedAt?: Date | null;
  emailVerifiedAt?: Date | null;
}

export interface CreateTenantOptions {
  slug: string;
  legalName?: string;
  displayName?: string;
  billingEmail?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoUrl?: string | null;
  defaultLocale?: string;
  defaultTimezone?: string;
  status?: TenantStatus;
}

export interface CreateBranchOptions {
  slug: string;
  name?: string;
  address?: string;
  phone?: string;
  timezone?: string | null;
  status?: BranchStatus;
}

export interface RoleAssignmentMetadata {
  assignedBy?: User | null;
  assignmentReason?: string | null;
  revokedBy?: User | null;
  revokedAt?: Date | null;
  revocationReason?: string | null;
}

export interface CreateTenantWithBranchOptions {
  tenant: CreateTenantOptions;
  branch: CreateBranchOptions;
}

export function createAuthFixtures({
  manager,
  password,
  bcryptSaltRounds,
}: AuthFixtureOptions) {
  async function createUser(options: CreateUserOptions = {}): Promise<User> {
    const email = options.email ?? 'active-user@example.test';

    return manager.save(
      manager.create(User, {
        email,
        emailNormalized: email.toLowerCase(),
        fullName: options.fullName ?? 'Synthetic User',
        status: options.status ?? UserStatus.ACTIVE,
        passwordHash: await hash(
          options.password ?? password,
          bcryptSaltRounds,
        ),
        passwordChangedAt: options.passwordChangedAt ?? null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        emailVerifiedAt: options.emailVerifiedAt ?? null,
      }),
    );
  }

  async function createTenant(options: CreateTenantOptions): Promise<Tenant> {
    const { slug } = options;

    return manager.save(
      manager.create(Tenant, {
        legalName: options.legalName ?? `Synthetic ${slug} LLC`,
        displayName: options.displayName ?? `Synthetic ${slug}`,
        slug,
        billingEmail: options.billingEmail ?? `${slug}@billing.test`,
        contactEmail: options.contactEmail ?? null,
        contactPhone: options.contactPhone ?? null,
        logoUrl: options.logoUrl ?? null,
        defaultLocale: options.defaultLocale ?? 'vi',
        defaultTimezone: options.defaultTimezone ?? 'Asia/Ho_Chi_Minh',
        status: options.status ?? TenantStatus.ACTIVE,
      }),
    );
  }

  async function createBranch(
    tenant: Tenant,
    options: CreateBranchOptions,
  ): Promise<Branch> {
    const { slug } = options;

    return manager.save(
      manager.create(Branch, {
        tenantId: tenant.id,
        slug,
        name: options.name ?? `Synthetic ${tenant.slug} ${slug}`,
        address: options.address ?? '1 Synthetic Street',
        phone: options.phone ?? '+84900000000',
        timezone: options.timezone ?? null,
        status: options.status ?? BranchStatus.ACTIVE,
      }),
    );
  }

  async function grantPlatformRole(
    user: User,
    roleCode: PlatformRoleCode,
    metadata: RoleAssignmentMetadata = {},
  ): Promise<PlatformRoleAssignment> {
    return manager.save(
      manager.create(PlatformRoleAssignment, {
        userId: user.id,
        roleCode,
        assignedByUserId: metadata.assignedBy?.id ?? null,
        assignmentReason: metadata.assignmentReason ?? null,
        revokedByUserId: metadata.revokedBy?.id ?? null,
        revokedAt: metadata.revokedAt ?? null,
        revocationReason: metadata.revocationReason ?? null,
      }),
    );
  }

  async function grantTenantRole(
    user: User,
    tenant: Tenant,
    roleCode: TenantRoleCode.TENANT_ADMIN,
    metadata: RoleAssignmentMetadata = {},
  ): Promise<RoleAssignment> {
    await ensureTenantMembership(user, tenant);
    return manager.save(
      manager.create(RoleAssignment, {
        userId: user.id,
        tenantId: tenant.id,
        branchId: null,
        roleCode,
        assignedByUserId: metadata.assignedBy?.id ?? null,
        assignmentReason: metadata.assignmentReason ?? null,
        revokedByUserId: metadata.revokedBy?.id ?? null,
        revokedAt: metadata.revokedAt ?? null,
        revocationReason: metadata.revocationReason ?? null,
      }),
    );
  }

  async function grantBranchRole(
    user: User,
    branch: Branch,
    roleCode: Exclude<TenantRoleCode, TenantRoleCode.TENANT_ADMIN>,
    metadata: RoleAssignmentMetadata = {},
  ): Promise<RoleAssignment> {
    await ensureTenantMembership(user, { id: branch.tenantId });
    return manager.save(
      manager.create(RoleAssignment, {
        userId: user.id,
        tenantId: branch.tenantId,
        branchId: branch.id,
        roleCode,
        assignedByUserId: metadata.assignedBy?.id ?? null,
        assignmentReason: metadata.assignmentReason ?? null,
        revokedByUserId: metadata.revokedBy?.id ?? null,
        revokedAt: metadata.revokedAt ?? null,
        revocationReason: metadata.revocationReason ?? null,
      }),
    );
  }

  async function createTenantWithBranch({
    tenant: tenantOptions,
    branch: branchOptions,
  }: CreateTenantWithBranchOptions): Promise<{
    tenant: Tenant;
    branch: Branch;
  }> {
    const tenant = await createTenant(tenantOptions);
    const branch = await createBranch(tenant, branchOptions);

    return { tenant, branch };
  }

  async function ensureTenantMembership(
    user: User,
    tenant: Pick<Tenant, 'id'>,
  ): Promise<TenantUserMembership> {
    const existing = await manager.findOne(TenantUserMembership, {
      where: { tenantId: tenant.id, userId: user.id },
    });
    if (existing) return existing;
    return manager.save(
      manager.create(TenantUserMembership, {
        tenantId: tenant.id,
        userId: user.id,
        status: TenantUserMembershipStatus.ACTIVE,
        disabledAt: null,
        disabledByUserId: null,
        disabledReason: null,
      }),
    );
  }

  return {
    createUser,
    createTenant,
    createBranch,
    grantPlatformRole,
    grantTenantRole,
    grantBranchRole,
    ensureTenantMembership,
    createTenantWithBranch,
  };
}

import { Injectable } from '@nestjs/common';
import {
  platformRolePermissions,
  tenantRolePermissions,
} from './authorization.policy';
import { AuthorizationRepository } from './authorization.repository';
import {
  AuthorizationSnapshot,
  BranchAuthorizationSnapshot,
  EffectiveAuthorizationAccess,
  TenantAuthorizationSnapshot,
} from './authorization.types';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly authorizationRepository: AuthorizationRepository,
  ) {}

  async getAuthorizationSnapshot(
    userId: string,
  ): Promise<AuthorizationSnapshot> {
    const [platformAssignments, tenantAssignments] = await Promise.all([
      this.authorizationRepository.findActivePlatformRoleAssignments(userId),
      this.authorizationRepository.findActiveTenantRoleAssignments(userId),
    ]);

    const platformRoles = sortUnique(
      platformAssignments.map((assignment) => assignment.roleCode),
    );
    const tenantAccessById = new Map<string, TenantAuthorizationSnapshot>();

    for (const assignment of tenantAssignments) {
      const { tenant } = assignment;
      const tenantAccess = tenantAccessById.get(assignment.tenantId) ?? {
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          displayName: tenant.displayName,
          status: tenant.status,
        },
        roles: [],
        permissions: [],
        branches: [],
      };

      if (!assignment.branchId) {
        tenantAccess.roles.push(assignment.roleCode);
        tenantAccess.permissions.push(
          ...tenantRolePermissions[assignment.roleCode],
        );
      } else {
        const { branch } = assignment;
        if (!branch) {
          continue;
        }

        const branchAccess = tenantAccess.branches.find(
          (candidate) => candidate.branch.id === branch.id,
        ) ?? {
          branch: {
            id: branch.id,
            slug: branch.slug,
            name: branch.name,
            status: branch.status,
          },
          roles: [],
          permissions: [],
        };

        if (!tenantAccess.branches.includes(branchAccess)) {
          tenantAccess.branches.push(branchAccess);
        }

        branchAccess.roles.push(assignment.roleCode);
        branchAccess.permissions.push(
          ...tenantRolePermissions[assignment.roleCode],
        );
      }

      tenantAccessById.set(assignment.tenantId, tenantAccess);
    }

    const tenants = [...tenantAccessById.values()]
      .map(normalizeTenantAccess)
      .sort(
        (left, right) =>
          compareText(left.tenant.slug, right.tenant.slug) ||
          compareText(left.tenant.id, right.tenant.id),
      );

    return {
      platform: {
        roles: platformRoles,
        permissions: sortUnique(
          platformRoles.flatMap((role) => platformRolePermissions[role]),
        ),
      },
      tenants,
    };
  }

  async getPlatformAccess(
    userId: string,
  ): Promise<EffectiveAuthorizationAccess> {
    const assignments =
      await this.authorizationRepository.findActivePlatformRoleAssignments(
        userId,
      );
    const platformRoles = sortUnique(
      assignments.map((assignment) => assignment.roleCode),
    );

    return {
      platformRoles,
      tenantRoles: [],
      permissions: sortUnique(
        platformRoles.flatMap((role) => platformRolePermissions[role]),
      ),
    };
  }

  async getTenantAccess(
    userId: string,
    tenantId: string,
    branchId?: string,
  ): Promise<EffectiveAuthorizationAccess> {
    const assignments =
      await this.authorizationRepository.findActiveTenantRoleAssignmentsForScope(
        userId,
        tenantId,
        branchId,
      );
    const tenantRoles = sortUnique(
      assignments.map((assignment) => assignment.roleCode),
    );

    return {
      platformRoles: [],
      tenantRoles,
      permissions: sortUnique(
        tenantRoles.flatMap((role) => tenantRolePermissions[role]),
      ),
    };
  }
}

function normalizeTenantAccess(
  tenantAccess: TenantAuthorizationSnapshot,
): TenantAuthorizationSnapshot {
  return {
    ...tenantAccess,
    roles: sortUnique(tenantAccess.roles),
    permissions: sortUnique(tenantAccess.permissions),
    branches: tenantAccess.branches
      .map(normalizeBranchAccess)
      .sort(
        (left, right) =>
          compareText(left.branch.name, right.branch.name) ||
          compareText(left.branch.id, right.branch.id),
      ),
  };
}

function normalizeBranchAccess(
  branchAccess: BranchAuthorizationSnapshot,
): BranchAuthorizationSnapshot {
  return {
    ...branchAccess,
    roles: sortUnique(branchAccess.roles),
    permissions: sortUnique(branchAccess.permissions),
  };
}

function sortUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

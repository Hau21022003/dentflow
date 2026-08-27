import type {
  AuthUser,
  Permission,
  TenantAuthorization,
  TenantLookup,
} from "./auth.types";

export function findTenantAuthorization(
  user: AuthUser | null | undefined,
  lookup: TenantLookup,
): TenantAuthorization | undefined {
  if (!user) {
    return undefined;
  }

  return user.authorization.tenants.find(({ tenant }) =>
    "id" in lookup ? tenant.id === lookup.id : tenant.slug === lookup.slug,
  );
}

export function findBranchAuthorization(
  user: AuthUser | null | undefined,
  lookup: TenantLookup,
  branchSlug: string,
): TenantAuthorization["branches"][number] | undefined {
  return findTenantAuthorization(user, lookup)?.branches.find(
    ({ branch }) => branch.slug === branchSlug,
  );
}

export function hasTenantAccess(
  user: AuthUser | null | undefined,
  lookup: TenantLookup,
): boolean {
  return findTenantAuthorization(user, lookup) !== undefined;
}

export function hasBranchAccess(
  user: AuthUser | null | undefined,
  lookup: TenantLookup,
  branchSlug: string,
): boolean {
  return findBranchAuthorization(user, lookup, branchSlug) !== undefined;
}

export function hasPlatformPermission(
  user: AuthUser | null | undefined,
  permission: Permission,
): boolean {
  return user?.authorization.platform.permissions.includes(permission) ?? false;
}

export function hasTenantPermission(
  user: AuthUser | null | undefined,
  lookup: TenantLookup,
  permission: Permission,
): boolean {
  return (
    findTenantAuthorization(user, lookup)?.permissions.includes(permission) ??
    false
  );
}

export function hasBranchPermission(
  user: AuthUser | null | undefined,
  lookup: TenantLookup,
  branchSlug: string,
  permission: Permission,
): boolean {
  const tenantAuthorization = findTenantAuthorization(user, lookup);
  if (!tenantAuthorization) {
    return false;
  }

  return (
    tenantAuthorization.permissions.includes(permission) ||
    findBranchAuthorization(user, lookup, branchSlug)?.permissions.includes(
      permission,
    ) === true
  );
}

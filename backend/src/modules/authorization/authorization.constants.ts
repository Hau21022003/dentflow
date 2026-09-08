export const AUTHORIZATION_SCOPE_KEY = 'authorizationScope';
export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const ALLOW_INACTIVE_TENANT_ACCESS_KEY =
  'authorization:allowInactiveTenantAccess';

export type AuthorizationScope = 'platform' | 'tenant' | 'branch';

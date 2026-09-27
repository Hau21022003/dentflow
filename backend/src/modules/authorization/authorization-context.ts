import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { BranchStatus } from '../branches/entities/branch.entity';
import type { TenantStatus } from '../tenants/entities/tenant.entity';
import type { AuthorizationScope } from './authorization.constants';
import type { EffectiveAuthorizationAccess } from './authorization.types';

export interface AuthorizationContext {
  actor: {
    userId: string;
    sessionId: string;
  };
  scope: AuthorizationScope;
  tenant?: {
    id: string;
    slug: string;
    status: TenantStatus;
  };
  branch?: {
    id: string;
    slug: string;
    /** Branch override, or the tenant default, resolved by TenantContextService. */
    timezone: string;
    status: BranchStatus;
  };
  access?: EffectiveAuthorizationAccess;
}

export type AuthenticatedRequest = Request & {
  user?: AccessTokenPayload;
  authorizationContext?: AuthorizationContext;
};

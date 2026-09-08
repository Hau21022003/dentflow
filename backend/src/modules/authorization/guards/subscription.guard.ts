import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantStatus } from '../../tenants/entities/tenant.entity';
import { type AuthenticatedRequest } from '../authorization-context';
import { ALLOW_INACTIVE_TENANT_ACCESS_KEY } from '../authorization.constants';

/**
 * Tenant.status is the lifecycle aggregate. PAST_DUE remains available as the
 * provider grace-period state; the lifecycle/webhook service moves it to
 * SUSPENDED once the grace policy ends. Billing/read-only routes opt out with
 * AllowInactiveTenantAccess.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowInactive = this.reflector.getAllAndOverride<boolean>(
      ALLOW_INACTIVE_TENANT_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowInactive) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const status = request.authorizationContext?.tenant?.status;
    if (!status) {
      throw new ForbiddenException('Tenant context is required.');
    }

    if (
      status === TenantStatus.PROVISIONING ||
      status === TenantStatus.SUSPENDED ||
      status === TenantStatus.CANCELED
    ) {
      throw new ForbiddenException(
        'Tenant subscription does not permit this operation.',
      );
    }

    return true;
  }
}

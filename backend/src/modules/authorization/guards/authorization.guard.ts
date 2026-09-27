import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type AuthenticatedRequest,
  type AuthorizationContext,
} from '../authorization-context';
import {
  AUTHORIZATION_SCOPE_KEY,
  REQUIRED_ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
  type AuthorizationScope,
} from '../authorization.constants';
import type { Permission } from '../authorization.policy';
import { AuthorizationService } from '../authorization.service';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * Kiểm tra authorization cho route đã khai báo scope.
   *
   * - Platform scope: kiểm tra platform role/permission của user.
   * - Tenant/branch scope: dùng context đã được TenantContextGuard resolve
   *   từ URL, rồi kiểm tra active role assignment và permission tương ứng.
   *
   * Không tự resolve tenant/branch từ client input; context phải tồn tại trước.
   * Ném 401 khi chưa xác thực, 403 khi không có role hoặc thiếu permission.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.getAllAndOverride<AuthorizationScope>(
      AUTHORIZATION_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!scope) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const authorizationContext = this.getAuthorizationContext(
      request.authorizationContext,
      scope,
      user.sub,
      user.sid,
    );
    const access =
      scope === 'platform'
        ? await this.authorizationService.getPlatformAccess(user.sub)
        : await this.authorizationService.getTenantAccess(
            user.sub,
            authorizationContext.tenant!.id,
            scope === 'branch' ? authorizationContext.branch!.id : undefined,
          );

    if (access.platformRoles.length === 0 && access.tenantRoles.length === 0) {
      throw new ForbiddenException('No active role assignment for this scope.');
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (
      requiredPermissions &&
      !requiredPermissions.every((permission) =>
        access.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException('Missing required permission.');
    }

    const requiredAnyPermissions = this.reflector.getAllAndOverride<
      Permission[]
    >(REQUIRED_ANY_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (
      requiredAnyPermissions &&
      !requiredAnyPermissions.some((permission) =>
        access.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException('Missing required permission.');
    }

    request.authorizationContext = { ...authorizationContext, access };

    return true;
  }

  private getAuthorizationContext(
    authorizationContext: AuthorizationContext | undefined,
    scope: AuthorizationScope,
    userId: string,
    sessionId: string,
  ): AuthorizationContext {
    if (scope === 'platform') {
      return (
        authorizationContext ?? {
          actor: { userId, sessionId },
          scope,
        }
      );
    }

    if (
      !authorizationContext?.tenant ||
      (scope === 'branch' && !authorizationContext.branch)
    ) {
      throw new ForbiddenException(
        'Tenant context is required for this route.',
      );
    }

    return authorizationContext;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AuthenticatedRequest } from '../authorization-context';
import {
  AUTHORIZATION_SCOPE_KEY,
  type AuthorizationScope,
} from '../authorization.constants';
import { TenantContextService } from '../tenant-context.service';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * Resolve tenant/branch context đáng tin cậy cho route tenant-scoped.
   *
   * Tenant được tìm từ `tenantSlug`; branch được tìm từ cặp
   * `tenantSlug + branchSlug`, nên branch của tenant khác không thể tạo context.
   *
   * Hàm chỉ xác định target context, chưa kiểm tra user có quyền truy cập hay
   * có permission trong context đó. AuthorizationGuard thực hiện phần đó sau này.
   *
   * Ném 401 nếu request chưa có JWT hợp lệ; ném 404 nếu tenant/branch không tồn tại
   * hoặc branch không thuộc tenant trên URL.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.getAllAndOverride<AuthorizationScope>(
      AUTHORIZATION_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (scope !== 'tenant' && scope !== 'branch') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const tenantSlug = request.params.tenantSlug;

    if (!user) {
      throw new UnauthorizedException();
    }
    request.authorizationContext =
      await this.tenantContextService.resolveTenantContext(
        { userId: user.sub, sessionId: user.sid },
        scope,
        typeof tenantSlug === 'string' ? tenantSlug : undefined,
        scope === 'branch' && typeof request.params.branchSlug === 'string'
          ? request.params.branchSlug
          : undefined,
      );

    return true;
  }
}

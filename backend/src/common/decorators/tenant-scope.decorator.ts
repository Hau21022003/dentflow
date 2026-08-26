import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  AUTHORIZATION_SCOPE_KEY,
  type AuthorizationScope,
} from 'src/modules/authorization/authorization.constants';
import { AuthorizationGuard } from 'src/modules/authorization/guards/authorization.guard';
import { TenantContextGuard } from 'src/modules/authorization/guards/tenant-context.guard';

type TenantScope = Extract<AuthorizationScope, 'tenant' | 'branch'>;

export function TenantScope(
  scope: TenantScope,
): ClassDecorator & MethodDecorator {
  return applyDecorators(
    SetMetadata(AUTHORIZATION_SCOPE_KEY, scope),
    UseGuards(TenantContextGuard, AuthorizationGuard),
  );
}

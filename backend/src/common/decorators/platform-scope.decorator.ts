import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  AUTHORIZATION_SCOPE_KEY,
  type AuthorizationScope,
} from 'src/modules/authorization/authorization.constants';
import { AuthorizationGuard } from 'src/modules/authorization/guards/authorization.guard';

const PLATFORM_SCOPE: AuthorizationScope = 'platform';

export function PlatformScope(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    SetMetadata(AUTHORIZATION_SCOPE_KEY, PLATFORM_SCOPE),
    UseGuards(AuthorizationGuard),
  );
}

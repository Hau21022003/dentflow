import { SetMetadata } from '@nestjs/common';
import { REQUIRED_PERMISSIONS_KEY } from 'src/modules/authorization/authorization.constants';
import type { Permission } from 'src/modules/authorization/authorization.policy';

export function RequirePermissions(
  ...permissions: Permission[]
): ClassDecorator & MethodDecorator {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}

import { SetMetadata } from '@nestjs/common';
import { REQUIRED_ANY_PERMISSIONS_KEY } from 'src/modules/authorization/authorization.constants';
import type { Permission } from 'src/modules/authorization/authorization.policy';

/** Requires at least one permission without changing the existing AND contract. */
export function RequireAnyPermission(
  ...permissions: Permission[]
): ClassDecorator & MethodDecorator {
  return SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);
}

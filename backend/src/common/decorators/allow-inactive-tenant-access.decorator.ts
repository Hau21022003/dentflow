import { SetMetadata } from '@nestjs/common';
import { ALLOW_INACTIVE_TENANT_ACCESS_KEY } from 'src/modules/authorization/authorization.constants';

/**
 * Reserved for tenant billing and read-only retention routes. Operational
 * routes remain blocked when the aggregate tenant access status is inactive.
 */
export function AllowInactiveTenantAccess(): ClassDecorator & MethodDecorator {
  return SetMetadata(ALLOW_INACTIVE_TENANT_ACCESS_KEY, true);
}

import { SetMetadata } from '@nestjs/common';
import { ALLOW_INACTIVE_BRANCH_ACCESS_KEY } from 'src/modules/authorization/authorization.constants';

/**
 * Opt in a branch-scoped read-only route to historical access for an inactive
 * branch. Operational branch routes remain blocked by BranchActivityGuard.
 */
export function AllowInactiveBranchAccess(): ClassDecorator & MethodDecorator {
  return SetMetadata(ALLOW_INACTIVE_BRANCH_ACCESS_KEY, true);
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AuthenticatedRequest } from '../authorization-context';
import { ALLOW_INACTIVE_BRANCH_ACCESS_KEY } from '../authorization.constants';
import { BranchStatus } from '../../branches/entities/branch.entity';

/**
 * TenantScope applies this guard after tenant/branch context resolution. A
 * branch-scoped operational route cannot run for an inactive branch; explicit
 * read-only historical routes may opt in with AllowInactiveBranchAccess.
 */
@Injectable()
export class BranchActivityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowInactive = this.reflector.getAllAndOverride<boolean>(
      ALLOW_INACTIVE_BRANCH_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowInactive) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const branch = request.authorizationContext?.branch;
    if (!branch || branch.status === BranchStatus.ACTIVE) {
      return true;
    }

    throw new ForbiddenException(
      'This branch is inactive and cannot perform operational requests.',
    );
  }
}

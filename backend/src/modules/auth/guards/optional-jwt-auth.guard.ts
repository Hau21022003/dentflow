import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';

/** Validates an access cookie when present, while permitting an anonymous invite accept. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[ACCESS_TOKEN_COOKIE];
    return typeof token === 'string' && token.length > 0
      ? super.canActivate(context)
      : true;
  }
}

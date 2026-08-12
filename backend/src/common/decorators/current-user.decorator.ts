import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AccessTokenPayload } from 'src/modules/auth/auth.types';

type AuthenticatedRequest = Request & {
  user: AccessTokenPayload;
};

export const CurrentUser = createParamDecorator(
  (
    data: keyof AccessTokenPayload | undefined,
    ctx: ExecutionContext,
  ): AccessTokenPayload | AccessTokenPayload[keyof AccessTokenPayload] => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return data ? user[data] : user;
  },
);

export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest<AuthenticatedRequest>()?.user?.sub;
  },
);

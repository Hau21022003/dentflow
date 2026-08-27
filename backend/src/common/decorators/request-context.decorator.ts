import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  type AuthenticatedRequest,
  type AuthorizationContext,
} from 'src/modules/authorization/authorization-context';

export const RequestContext = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthorizationContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationContext = request.authorizationContext;

    if (!authorizationContext) {
      throw new InternalServerErrorException(
        'Authorization context is missing for this route.',
      );
    }

    return authorizationContext;
  },
);

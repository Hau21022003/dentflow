import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AppConfigService } from 'src/config/app-config.service';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import { AccessTokenPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request?: Request) => {
          const cookies: unknown = request?.cookies;
          if (!cookies || typeof cookies !== 'object') {
            return null;
          }

          const accessToken = (cookies as Record<string, unknown>)[
            ACCESS_TOKEN_COOKIE
          ];
          return typeof accessToken === 'string' ? accessToken : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.authConfig.jwtAccess.secret,
    });
  }

  validate(payload: unknown): AccessTokenPayload {
    if (!this.isAccessTokenPayload(payload)) {
      throw new UnauthorizedException('Invalid access token.');
    }

    return payload;
  }

  private isAccessTokenPayload(
    payload: unknown,
  ): payload is AccessTokenPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const candidate = payload as Partial<AccessTokenPayload>;
    return (
      candidate.typ === 'access' &&
      typeof candidate.sub === 'string' &&
      typeof candidate.sid === 'string'
    );
  }
}

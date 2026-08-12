import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from 'src/config/app-config.service';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => {
          return request?.cookies?.[ACCESS_TOKEN_COOKIE] || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.authConfig.jwtAccess.secret,
    });
  }

  async validate(payload) {
    return payload;
  }
}

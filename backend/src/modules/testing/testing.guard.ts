// src/modules/testing/testing.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AppConfigService } from 'src/config/app-config.service';

@Injectable()
export class TestingGuard implements CanActivate {
  constructor(private readonly appConfig: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.appConfig.runtimeConfig.isTesting) {
      throw new ForbiddenException('Only available in test environment');
    }

    return true;
  }
}

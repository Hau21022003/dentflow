// src/modules/testing/testing.guard.ts
import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { AppConfigService } from 'src/config/app-config.service';

@Injectable()
export class TestingGuard implements CanActivate {
  constructor(private readonly appConfig: AppConfigService) {}

  canActivate(): boolean {
    if (!this.appConfig.runtimeConfig.isTesting) {
      throw new ForbiddenException('Only available in test environment');
    }

    return true;
  }
}

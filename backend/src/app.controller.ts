import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { CurrentUserId } from './common/decorators/current-user.decorator';
import { Public } from './common/decorators/public.decorator';
import { AppLogger } from './common/logging/app-logger.service';
import { ContextLogger } from './common/logging/context-logger.type';

@Controller()
export class AppController {
  private readonly logger: ContextLogger;
  constructor(
    private readonly appService: AppService,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.forContext(AppController.name);
  }

  @Public()
  @Get()
  getHello(@CurrentUserId() userId: string): string {
    this.logger.debug('getHello', { userId });
    return this.appService.getHello();
  }
}

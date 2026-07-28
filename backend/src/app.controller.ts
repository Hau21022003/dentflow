import { Controller, Get, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { AppService } from './app.service';
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

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/test')
  @ApiBody({
    required: true,
    description: 'Synthetic payload used only to verify request logging.',
    schema: {
      type: 'object',
      example: {
        requestId: 'swagger-log-test-001',
        action: 'test_request_logging',
        metadata: {
          source: 'swagger',
          retry: false,
        },
        items: [
          {
            id: 'sample-item-001',
            quantity: 2,
          },
        ],
      },
    },
  })
  getTest(): string {
    this.logger.debug('test');
    return 'test';
  }
}

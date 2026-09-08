import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [RequestContextMiddleware, RequestContextService],
  exports: [RequestContextMiddleware, RequestContextService],
})
export class RequestContextModule {}

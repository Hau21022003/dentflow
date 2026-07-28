import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from 'src/config/app-config.module';
import { AppLogger } from './app-logger.service';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggingModule {}

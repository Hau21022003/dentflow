import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationTestingController } from './authorization-testing.controller';
import { TestingController } from './testing.controller';
import { TestingGuard } from './testing.guard';
import { TestingService } from './testing.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [TestingController, AuthorizationTestingController],
  providers: [TestingService, TestingGuard],
})
export class TestingModule {}

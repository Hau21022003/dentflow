import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';
import { TestingGuard } from './testing.guard';
import { TestingService } from './testing.service';

@Module({
  controllers: [TestingController],
  providers: [TestingService, TestingGuard],
})
export class TestingModule {}

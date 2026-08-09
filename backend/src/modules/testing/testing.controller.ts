import { Controller, Get, UseGuards } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { TestingGuard } from './testing.guard';
import { TestingService } from './testing.service';

@Public()
@UseGuards(TestingGuard)
@Controller('testing')
export class TestingController {
  private resetQueue: Promise<void> = Promise.resolve();
  constructor(private readonly testingService: TestingService) {}

  @Get('reset-db')
  async resetDb() {
    const task = this.resetQueue.then(() =>
      this.testingService.resetDatabase(),
    );

    this.resetQueue = task.catch(() => undefined);

    await task;

    return {
      message: 'Database reset successfully',
    };
  }
}

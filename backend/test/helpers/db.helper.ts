import { INestApplication } from '@nestjs/common';
import { TestingService } from 'src/modules/testing/testing.service';
// import { seedUsersToDb } from 'test/fixtures/user.fixture';

export async function resetDbToBaseState(app: INestApplication) {
  const testingService = app.get(TestingService);
  await testingService.resetDatabase();

  // await seedUsersToDb(app.get(DataSource));
}

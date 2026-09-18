import * as dotenv from 'dotenv';
import * as path from 'path';
import dataSource from './data-source';
import { readSeedFiles, resetDatabaseWithSeeds } from './database-reset';
import { assertDevelopmentDatabaseResetAllowed } from './dev-reset-guard';

const environment = process.env.NODE_ENV ?? 'development';
dotenv.config({ path: `.env.${environment}` });

async function resetDevelopmentDatabase(): Promise<void> {
  assertDevelopmentDatabaseResetAllowed();

  const seedDirectory = path.join(__dirname, 'seeds', 'dev');
  const seedFiles = readSeedFiles(seedDirectory);

  await dataSource.initialize();

  try {
    await resetDatabaseWithSeeds(dataSource, seedFiles);
    console.log(
      `Development database reset successfully with ${seedFiles.length} seed file(s).`,
    );
  } finally {
    await dataSource.destroy();
  }
}

resetDevelopmentDatabase().catch((error: unknown) => {
  console.error('Development database reset failed:', error);
  process.exit(1);
});

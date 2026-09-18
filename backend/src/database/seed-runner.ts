// database/seeds/runner.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import dataSource from './data-source';
import { readSeedFiles, runSeedFiles } from './database-reset';

const env = process.env.NODE_ENV ?? 'development';
dotenv.config({ path: `.env.${env}` });
const seedEnv = env === 'development' ? 'dev' : env;

async function runSeeds(): Promise<void> {
  const seedDirectory = path.join(__dirname, 'seeds', seedEnv);
  const seedFiles = readSeedFiles(seedDirectory);

  if (seedFiles.length === 0) {
    console.log('No seed files found.');
    return;
  }

  console.log(`Found ${seedFiles.length} seed file(s) in [${seedEnv}]`);

  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const result = await runSeedFiles(queryRunner, seedFiles);

    for (const file of result.skipped) {
      console.log(`Skipped (empty): ${file}`);
    }
    for (const file of result.seeded) {
      console.log(`Seeded: ${file}`);
    }

    await queryRunner.commitTransaction();
    console.log('All seeds committed successfully.');
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }

    throw error;
  } finally {
    if (!queryRunner.isReleased) {
      await queryRunner.release();
    }
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

runSeeds().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});

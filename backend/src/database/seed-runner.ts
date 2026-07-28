// database/seeds/runner.ts
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from './data-source';

const env = process.env.NODE_ENV ?? 'development';
dotenv.config({ path: `.env.${env}` });

async function runSeeds() {
  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  const seedDir = path.join(__dirname, 'seeds', env);

  if (!fs.existsSync(seedDir)) {
    console.error(`❌ Seed directory not found: ${seedDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(seedDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No seed files found.');
    await dataSource.destroy();
    return;
  }

  console.log(`📂 Found ${files.length} seed file(s) in [${env}]`);

  await queryRunner.startTransaction();

  try {
    for (const file of files) {
      const filePath = path.join(seedDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      const cleaned = sql.trim();

      if (!cleaned) {
        console.log(`⚠️  Skipped (empty): ${file}`);
        continue;
      }

      await queryRunner.query(cleaned);

      console.log(`✅ Seeded: ${file}`);
    }

    await queryRunner.commitTransaction();
    console.log('🎉 All seeds committed successfully.');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Seed failed, rolled back:', err);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

runSeeds().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

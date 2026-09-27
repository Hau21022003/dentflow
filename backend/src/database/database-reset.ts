import * as fs from 'fs';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';

export interface SeedFile {
  name: string;
  sql: string;
}

export type MissingSeedDirectoryBehavior = 'error' | 'ignore';

export function readSeedFiles(
  seedDirectory: string,
  missingDirectoryBehavior: MissingSeedDirectoryBehavior = 'error',
): SeedFile[] {
  if (!fs.existsSync(seedDirectory)) {
    if (missingDirectoryBehavior === 'ignore') {
      return [];
    }

    throw new Error(`Seed directory not found: ${seedDirectory}`);
  }

  return fs
    .readdirSync(seedDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(seedDirectory, name), 'utf8').trim(),
    }));
}

export async function runSeedFiles(
  queryRunner: QueryRunner,
  seedFiles: readonly SeedFile[],
): Promise<{ seeded: string[]; skipped: string[] }> {
  const seeded: string[] = [];
  const skipped: string[] = [];

  for (const seedFile of seedFiles) {
    if (!seedFile.sql) {
      skipped.push(seedFile.name);
      continue;
    }

    await queryRunner.query(seedFile.sql);
    seeded.push(seedFile.name);
  }

  return { seeded, skipped };
}

export async function resetDatabaseWithSeeds(
  dataSource: DataSource,
  seedFiles: readonly SeedFile[],
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const tableRows: unknown = await queryRunner.query(
      `SELECT format('%I.%I', schemaname, tablename) AS "qualifiedName"
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename != 'migrations'`,
    );
    const tableNames = qualifiedTableNames(tableRows);

    if (tableNames.length > 0) {
      await queryRunner.query(
        `TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`,
      );
    }

    await runSeedFiles(queryRunner, seedFiles);
    await queryRunner.commitTransaction();
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }

    throw error;
  } finally {
    await queryRunner.release();
  }
}

function qualifiedTableNames(tableRows: unknown): string[] {
  if (!Array.isArray(tableRows)) {
    return [];
  }

  return tableRows.reduce<string[]>((tableNames, row) => {
    if (isQualifiedTableName(row)) {
      tableNames.push(row.qualifiedName);
    }

    return tableNames;
  }, []);
}

function isQualifiedTableName(row: unknown): row is { qualifiedName: string } {
  return (
    typeof row === 'object' &&
    row !== null &&
    'qualifiedName' in row &&
    typeof row.qualifiedName === 'string'
  );
}

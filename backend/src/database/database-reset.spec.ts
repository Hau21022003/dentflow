import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import {
  readSeedFiles,
  resetDatabaseWithSeeds,
  SeedFile,
} from './database-reset';

describe('database reset', () => {
  it('reads SQL seed files in lexical order', () => {
    const seedDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dentflow-seeds-'),
    );

    try {
      fs.writeFileSync(path.join(seedDirectory, '020-second.sql'), 'SELECT 2;');
      fs.writeFileSync(path.join(seedDirectory, '010-first.sql'), 'SELECT 1;');
      fs.writeFileSync(path.join(seedDirectory, 'README.md'), 'ignored');

      expect(readSeedFiles(seedDirectory)).toEqual([
        { name: '010-first.sql', sql: 'SELECT 1;' },
        { name: '020-second.sql', sql: 'SELECT 2;' },
      ]);
    } finally {
      fs.rmSync(seedDirectory, { force: true, recursive: true });
    }
  });

  it('truncates public tables except migrations and runs non-empty seeds in order', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { qualifiedName: 'public.users' },
        { qualifiedName: 'public.tenants' },
      ])
      .mockResolvedValue(undefined);
    const queryRunnerMocks = createQueryRunner(query);
    const dataSource = createDataSource(queryRunnerMocks.queryRunner);
    const seedFiles: SeedFile[] = [
      { name: '010-tenants.sql', sql: 'SELECT first_seed();' },
      { name: '020-empty.sql', sql: '' },
      { name: '030-users.sql', sql: 'SELECT second_seed();' },
    ];

    await resetDatabaseWithSeeds(dataSource, seedFiles);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("tablename != 'migrations'"),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'TRUNCATE TABLE public.users, public.tenants RESTART IDENTITY CASCADE',
    );
    expect(query).toHaveBeenNthCalledWith(3, 'SELECT first_seed();');
    expect(query).toHaveBeenNthCalledWith(4, 'SELECT second_seed();');
    expect(queryRunnerMocks.startTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMocks.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMocks.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunnerMocks.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back truncate and seeds when a seed query fails', async () => {
    const seedFailure = new Error('seed failed');
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ qualifiedName: 'public.users' }])
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(seedFailure);
    const queryRunnerMocks = createQueryRunner(query, true);
    const dataSource = createDataSource(queryRunnerMocks.queryRunner);

    await expect(
      resetDatabaseWithSeeds(dataSource, [
        { name: '010-users.sql', sql: 'SELECT fails();' },
      ]),
    ).rejects.toThrow(seedFailure);

    expect(queryRunnerMocks.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunnerMocks.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunnerMocks.release).toHaveBeenCalledTimes(1);
  });

  function createDataSource(queryRunner: QueryRunner): DataSource {
    return {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource;
  }

  function createQueryRunner(
    query: jest.Mock,
    isTransactionActive = false,
  ): QueryRunnerMocks {
    const connect = jest.fn();
    const startTransaction = jest.fn();
    const commitTransaction = jest.fn();
    const rollbackTransaction = jest.fn();
    const release = jest.fn();

    return {
      queryRunner: {
        connect,
        startTransaction,
        commitTransaction,
        rollbackTransaction,
        release,
        query,
        isTransactionActive,
      } as unknown as QueryRunner,
      startTransaction,
      commitTransaction,
      rollbackTransaction,
      release,
    };
  }
});

interface QueryRunnerMocks {
  queryRunner: QueryRunner;
  startTransaction: jest.Mock;
  commitTransaction: jest.Mock;
  rollbackTransaction: jest.Mock;
  release: jest.Mock;
}

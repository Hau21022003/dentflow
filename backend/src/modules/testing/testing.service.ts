import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
// import { AppCacheService } from '../shared/cache/app-cache.service';

@Injectable()
export class TestingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // private readonly appCacheService: AppCacheService,
  ) {}

  async resetDatabase(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const tables: { qualifiedName: string }[] = await queryRunner.query(
        `SELECT format('%I.%I', schemaname, tablename) AS "qualifiedName"
         FROM pg_tables
         WHERE schemaname = 'public'
           AND tablename != 'migrations'`,
      );

      if (tables.length > 0) {
        await queryRunner.query(
          `TRUNCATE TABLE ${tables
            .map(({ qualifiedName }) => qualifiedName)
            .join(', ')} RESTART IDENTITY CASCADE`,
        );
      }

      await this.runSeeds(queryRunner);
      await queryRunner.commitTransaction();

      // await this.appCacheService.clear();
      console.log('Database reset successfully');
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async runSeeds(queryRunner: QueryRunner): Promise<void> {
    const seedDir = path.join(process.cwd(), 'src/database/seeds/test');

    if (!fs.existsSync(seedDir)) return;

    const files = fs
      .readdirSync(seedDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(seedDir, file), 'utf8').trim();
      if (!sql) continue;

      await queryRunner.query(sql);
    }
  }
}

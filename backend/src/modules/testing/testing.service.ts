import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
// import { AppCacheService } from '../shared/cache/app-cache.service';

@Injectable()
export class TestingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // private readonly appCacheService: AppCacheService,
  ) {}
  async resetDatabase() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // 1. Lấy tất cả tên bảng trong DB hiện tại
    const tables: { TABLE_NAME: string }[] = await queryRunner.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME != 'migrations'`, // Giữ lại bảng migrations
    );

    // 2. Tắt FK check để truncate không bị lỗi quan hệ
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 0`);

    for (const { TABLE_NAME } of tables) {
      await queryRunner.query(`TRUNCATE TABLE \`${TABLE_NAME}\``);
    }

    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 1`);

    // 3. Re-run migrations
    await this.dataSource.runMigrations();

    // 4. Re-seed
    await this.runSeeds(queryRunner);

    // await this.appCacheService.clear();

    console.log('Database reset successfully');

    await queryRunner.release();
  }

  private async runSeeds(queryRunner: any) {
    const seedDir = path.join(process.cwd(), 'src/database/seeds/test');

    if (!fs.existsSync(seedDir)) return;

    const files = fs
      .readdirSync(seedDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    await queryRunner.startTransaction();
    try {
      for (const file of files) {
        const sql = fs.readFileSync(path.join(seedDir, file), 'utf8').trim();
        if (!sql) continue;

        await queryRunner.query(sql);
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as path from 'path';
import { DataSource } from 'typeorm';
import {
  readSeedFiles,
  resetDatabaseWithSeeds,
} from '../../database/database-reset';
// import { AppCacheService } from '../shared/cache/app-cache.service';

@Injectable()
export class TestingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // private readonly appCacheService: AppCacheService,
  ) {}

  async resetDatabase(): Promise<void> {
    const seedDir = path.join(process.cwd(), 'src/database/seeds/test');
    const seedFiles = readSeedFiles(seedDir, 'ignore');

    await resetDatabaseWithSeeds(this.dataSource, seedFiles);
  }
}

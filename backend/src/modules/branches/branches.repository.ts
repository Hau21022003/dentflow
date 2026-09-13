import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';

@Injectable()
export class BranchesRepository {
  constructor(
    @InjectRepository(Branch)
    readonly ormRepository: Repository<Branch>,
  ) {}

  async findByTenantAndSlugForUpdate(
    manager: EntityManager,
    tenantId: string,
    slug: string,
  ): Promise<Branch | null> {
    return manager
      .getRepository(Branch)
      .createQueryBuilder('branch')
      .setLock('pessimistic_write')
      .where('branch.tenantId = :tenantId', { tenantId })
      .andWhere('branch.slug = :slug', { slug })
      .getOne();
  }
}

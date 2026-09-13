import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ServiceGroup } from './entities/service-group.entity';

@Injectable()
export class ServiceGroupsRepository {
  constructor(
    @InjectRepository(ServiceGroup)
    readonly ormRepository: Repository<ServiceGroup>,
  ) {}

  async findByTenantAndId(
    tenantId: string,
    serviceGroupId: string,
  ): Promise<ServiceGroup | null> {
    return this.ormRepository.findOne({
      where: { id: serviceGroupId, tenantId },
    });
  }

  async findByTenantAndIdForUpdate(
    manager: EntityManager,
    tenantId: string,
    serviceGroupId: string,
  ): Promise<ServiceGroup | null> {
    return manager
      .getRepository(ServiceGroup)
      .createQueryBuilder('serviceGroup')
      .setLock('pessimistic_write')
      .where('serviceGroup.tenantId = :tenantId', { tenantId })
      .andWhere('serviceGroup.id = :serviceGroupId', { serviceGroupId })
      .getOne();
  }
}

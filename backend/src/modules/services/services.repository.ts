import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Service } from './entities/service.entity';

@Injectable()
export class ServicesRepository {
  constructor(
    @InjectRepository(Service)
    readonly ormRepository: Repository<Service>,
  ) {}

  async findByTenantAndId(
    tenantId: string,
    serviceId: string,
  ): Promise<Service | null> {
    return this.ormRepository.findOne({ where: { id: serviceId, tenantId } });
  }

  async findByTenantAndIdForUpdate(
    manager: EntityManager,
    tenantId: string,
    serviceId: string,
  ): Promise<Service | null> {
    return manager
      .getRepository(Service)
      .createQueryBuilder('service')
      .setLock('pessimistic_write')
      .where('service.tenantId = :tenantId', { tenantId })
      .andWhere('service.id = :serviceId', { serviceId })
      .getOne();
  }
}

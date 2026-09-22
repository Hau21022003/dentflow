import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { Visit } from './entities/visit.entity';

@Injectable()
export class VisitsRepository {
  constructor(
    @InjectRepository(Visit)
    private readonly ormRepository: Repository<Visit>,
  ) {}

  detailsQuery(
    manager: EntityManager | undefined = undefined,
  ): SelectQueryBuilder<Visit> {
    const repository = manager
      ? manager.getRepository(Visit)
      : this.ormRepository;

    return repository
      .createQueryBuilder('visit')
      .leftJoinAndSelect('visit.addenda', 'addendum')
      .leftJoinAndSelect('addendum.author', 'addendumAuthor')
      .orderBy('addendum.createdAt', 'ASC')
      .addOrderBy('addendum.id', 'ASC');
  }

  findByTenantBranchAndAppointmentId(
    tenantId: string,
    branchId: string,
    appointmentId: string,
  ): Promise<Visit | null> {
    return this.detailsQuery()
      .where('visit.tenantId = :tenantId', { tenantId })
      .andWhere('visit.branchId = :branchId', { branchId })
      .andWhere('visit.appointmentId = :appointmentId', { appointmentId })
      .getOne();
  }

  findByTenantBranchAndAppointmentIdForUpdate(
    manager: EntityManager,
    tenantId: string,
    branchId: string,
    appointmentId: string,
  ): Promise<Visit | null> {
    return manager
      .getRepository(Visit)
      .createQueryBuilder('visit')
      .setLock('pessimistic_write')
      .where('visit.tenantId = :tenantId', { tenantId })
      .andWhere('visit.branchId = :branchId', { branchId })
      .andWhere('visit.appointmentId = :appointmentId', { appointmentId })
      .getOne();
  }

  findDetailsByTenantBranchAndAppointmentId(
    manager: EntityManager,
    tenantId: string,
    branchId: string,
    appointmentId: string,
  ): Promise<Visit | null> {
    return this.detailsQuery(manager)
      .where('visit.tenantId = :tenantId', { tenantId })
      .andWhere('visit.branchId = :branchId', { branchId })
      .andWhere('visit.appointmentId = :appointmentId', { appointmentId })
      .getOne();
  }
}

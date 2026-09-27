import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { Appointment } from './entities/appointment.entity';

@Injectable()
export class AppointmentsRepository {
  constructor(
    @InjectRepository(Appointment)
    readonly ormRepository: Repository<Appointment>,
  ) {}

  detailsQuery(
    manager: EntityManager | undefined = undefined,
  ): SelectQueryBuilder<Appointment> {
    const repository = manager
      ? manager.getRepository(Appointment)
      : this.ormRepository;

    return repository
      .createQueryBuilder('appointment')
      .innerJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.assignedDentist', 'assignedDentist');
  }

  findByTenantBranchAndId(
    tenantId: string,
    branchId: string,
    appointmentId: string,
  ): Promise<Appointment | null> {
    return this.detailsQuery()
      .where('appointment.tenantId = :tenantId', { tenantId })
      .andWhere('appointment.branchId = :branchId', { branchId })
      .andWhere('appointment.id = :appointmentId', { appointmentId })
      .getOne();
  }

  findByTenantBranchAndIdForUpdate(
    manager: EntityManager,
    tenantId: string,
    branchId: string,
    appointmentId: string,
  ): Promise<Appointment | null> {
    return manager
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .setLock('pessimistic_write')
      .where('appointment.tenantId = :tenantId', { tenantId })
      .andWhere('appointment.branchId = :branchId', { branchId })
      .andWhere('appointment.id = :appointmentId', { appointmentId })
      .getOne();
  }

  findDetailsByTenantBranchAndId(
    manager: EntityManager,
    tenantId: string,
    branchId: string,
    appointmentId: string,
  ): Promise<Appointment | null> {
    return this.detailsQuery(manager)
      .where('appointment.tenantId = :tenantId', { tenantId })
      .andWhere('appointment.branchId = :branchId', { branchId })
      .andWhere('appointment.id = :appointmentId', { appointmentId })
      .getOne();
  }
}

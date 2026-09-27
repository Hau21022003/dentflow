import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';

@Injectable()
export class PatientsRepository {
  constructor(
    @InjectRepository(Patient)
    readonly ormRepository: Repository<Patient>,
  ) {}

  findByTenantAndId(
    tenantId: string,
    patientId: string,
  ): Promise<Patient | null> {
    return this.ormRepository.findOne({ where: { id: patientId, tenantId } });
  }

  findByTenantAndIdForUpdate(
    manager: EntityManager,
    tenantId: string,
    patientId: string,
  ): Promise<Patient | null> {
    return manager
      .getRepository(Patient)
      .createQueryBuilder('patient')
      .setLock('pessimistic_write')
      .where('patient.tenantId = :tenantId', { tenantId })
      .andWhere('patient.id = :patientId', { patientId })
      .getOne();
  }
}

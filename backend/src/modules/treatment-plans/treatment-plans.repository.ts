import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TreatmentItemEvent } from './entities/treatment-item-event.entity';
import { TreatmentItem } from './entities/treatment-item.entity';
import { TreatmentPlan } from './entities/treatment-plan.entity';
@Injectable()
export class TreatmentPlansRepository {
  constructor(
    @InjectRepository(TreatmentPlan) readonly plans: Repository<TreatmentPlan>,
    @InjectRepository(TreatmentItem) readonly items: Repository<TreatmentItem>,
    @InjectRepository(TreatmentItemEvent)
    readonly events: Repository<TreatmentItemEvent>,
  ) {}
  findPlanForUpdate(
    manager: EntityManager,
    tenantId: string,
    branchId: string,
    id: string,
  ) {
    return manager
      .getRepository(TreatmentPlan)
      .createQueryBuilder('plan')
      .setLock('pessimistic_write')
      .where('plan.id=:id', { id })
      .andWhere('plan.tenantId=:tenantId', { tenantId })
      .andWhere('plan.branchId=:branchId', { branchId })
      .getOne();
  }
  findPlan(tenantId: string, branchId: string, id: string) {
    return this.plans.findOneBy({ id, tenantId, branchId });
  }
  findItems(manager: EntityManager, planId: string, lock = false) {
    const q = manager
      .getRepository(TreatmentItem)
      .createQueryBuilder('item')
      .where('item.treatmentPlanId=:planId', { planId })
      .orderBy('item.id', 'ASC');
    if (lock) q.setLock('pessimistic_write');
    return q.getMany();
  }
  findItemForUpdate(manager: EntityManager, planId: string, itemId: string) {
    return manager
      .getRepository(TreatmentItem)
      .createQueryBuilder('item')
      .setLock('pessimistic_write')
      .where('item.id=:itemId', { itemId })
      .andWhere('item.treatmentPlanId=:planId', { planId })
      .getOne();
  }
  findEventsPage(
    planId: string,
    itemId: string,
    cursor?: { createdAt: Date; id: string },
  ) {
    const q = this.events
      .createQueryBuilder('event')
      .where('event.treatmentPlanId=:planId', { planId })
      .andWhere('event.treatmentItemId=:itemId', { itemId })
      .orderBy('event.createdAt', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .take(51);
    if (cursor)
      q.andWhere(
        '(event.createdAt > :createdAt OR (event.createdAt = :createdAt AND event.id > :id))',
        cursor,
      );
    return q.getMany();
  }
}

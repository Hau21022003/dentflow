import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';

@Injectable()
export class SubscriptionPlansRepository {
  constructor(
    @InjectRepository(SubscriptionPlan)
    readonly ormRepository: Repository<SubscriptionPlan>,
  ) {}

  async findAll(): Promise<SubscriptionPlan[]> {
    return this.ormRepository.find({
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async findById(
    manager: EntityManager,
    planId: string,
  ): Promise<SubscriptionPlan | null> {
    return manager.getRepository(SubscriptionPlan).findOne({
      where: { id: planId },
    });
  }

  async hasSubscriptionHistory(
    manager: EntityManager,
    planId: string,
  ): Promise<boolean> {
    const subscription = await manager.getRepository(Subscription).findOne({
      select: { id: true },
      where: { planId },
    });

    return subscription !== null;
  }
}

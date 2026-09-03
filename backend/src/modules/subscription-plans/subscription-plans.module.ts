import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { SubscriptionPlansController } from './subscription-plans.controller';
import { SubscriptionPlansRepository } from './subscription-plans.repository';
import { SubscriptionPlansService } from './subscription-plans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionPlan, Subscription]),
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [SubscriptionPlansController],
  providers: [SubscriptionPlansService, SubscriptionPlansRepository],
})
export class SubscriptionPlansModule {}

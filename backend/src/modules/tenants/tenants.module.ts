import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../../infrastructure/email/email.module';
import { SubscriptionPlan } from '../subscription-plans/entities/subscription-plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from './entities/tenant.entity';
import { TenantOwnerInvitation } from './entities/tenant-owner-invitation.entity';
import { TenantsController } from './tenants.controller';
import { TenantInvitationTokenService } from './tenant-invitation-token.service';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';
import { TenantOwnerInvitationProcessor } from './jobs/tenant-owner-invitation.processor';
import { TenantOwnerInvitationProducer } from './jobs/tenant-owner-invitation.producer';
import { TenantInvitationQueueName } from './jobs/tenant-owner-invitation.types';

const isTesting = process.env.NODE_ENV === 'test';
const invitationQueueModule = BullModule.registerQueue({
  name: TenantInvitationQueueName,
});

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantOwnerInvitation,
      Subscription,
      SubscriptionPlan,
      User,
    ]),
    AuthorizationModule,
    AuditModule,
    AuthModule,
    EmailModule,
    ...(isTesting ? [] : [invitationQueueModule]),
  ],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    TenantsRepository,
    TenantInvitationTokenService,
    TenantLifecycleService,
    ...(isTesting
      ? [
          {
            provide: TenantOwnerInvitationProducer,
            useValue: { enqueueOwnerInvitation: () => Promise.resolve() },
          },
        ]
      : [TenantOwnerInvitationProducer, TenantOwnerInvitationProcessor]),
  ],
  exports: [TenantInvitationTokenService],
})
export class TenantsModule {}

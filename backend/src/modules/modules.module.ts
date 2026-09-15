import { Module } from '@nestjs/common';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { TestingModule } from './testing/testing.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { StaffModule } from './staff/staff.module';
import { ServicesModule } from './services/services.module';
import { ServiceGroupsModule } from './service-groups/service-groups.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    UsersModule,
    StaffModule,
    TenantsModule,
    SubscriptionPlansModule,
    BranchesModule,
    ServiceGroupsModule,
    UploadsModule,
    ServicesModule,
    IdempotencyModule,
    EmailTemplatesModule,
    AuditModule,
    AuthorizationModule,
    AuthModule,
    TestingModule,
  ],
})
export class ModulesModule {}

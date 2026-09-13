import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { RoleAssignment } from '../authorization/entities/role-assignment.entity';
import { AuditModule } from '../audit/audit.module';
import { Branch } from '../branches/entities/branch.entity';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { EmailModule } from '../../infrastructure/email/email.module';
import { StaffController } from './staff.controller';
import { StaffInvitation } from './entities/staff-invitation.entity';
import { StaffInvitationAssignment } from './entities/staff-invitation-assignment.entity';
import { TenantUserMembership } from './entities/tenant-user-membership.entity';
import { StaffInvitationProcessor } from './jobs/staff-invitation.processor';
import { StaffInvitationProducer } from './jobs/staff-invitation.producer';
import { StaffInvitationQueueName } from './jobs/staff-invitation.types';
import { StaffInvitationTokenService } from './staff-invitation-token.service';
import { StaffService } from './staff.service';

const isTesting = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Branch,
      RoleAssignment,
      StaffInvitation,
      StaffInvitationAssignment,
      Tenant,
      TenantUserMembership,
      User,
    ]),
    AuthModule,
    AuthorizationModule,
    AuditModule,
    EmailModule,
    EmailTemplatesModule,
    IdempotencyModule,
    ...(isTesting
      ? []
      : [BullModule.registerQueue({ name: StaffInvitationQueueName })]),
  ],
  controllers: [StaffController],
  providers: [
    StaffService,
    StaffInvitationTokenService,
    ...(isTesting
      ? [
          {
            provide: StaffInvitationProducer,
            useValue: { enqueueStaffInvitation: () => Promise.resolve() },
          },
        ]
      : [StaffInvitationProducer, StaffInvitationProcessor]),
  ],
})
export class StaffModule {}

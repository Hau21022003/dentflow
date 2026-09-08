import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationService } from './authorization.service';
import { PlatformRoleAssignment } from './entities/platform-role-assignment.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { AuthorizationGuard } from './guards/authorization.guard';
import { TenantContextGuard } from './guards/tenant-context.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { TenantContextService } from './tenant-context.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Branch,
      PlatformRoleAssignment,
      RoleAssignment,
      Tenant,
    ]),
  ],
  controllers: [AuthorizationController],
  providers: [
    AuthorizationService,
    AuthorizationRepository,
    AuthorizationGuard,
    TenantContextGuard,
    SubscriptionGuard,
    TenantContextService,
  ],
  exports: [
    AuthorizationService,
    AuthorizationGuard,
    TenantContextGuard,
    SubscriptionGuard,
    TenantContextService,
  ],
})
export class AuthorizationModule {}

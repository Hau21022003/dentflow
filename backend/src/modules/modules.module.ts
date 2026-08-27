import { Module } from '@nestjs/common';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { TestingModule } from './testing/testing.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    UsersModule,
    TenantsModule,
    BranchesModule,
    AuthorizationModule,
    AuthModule,
    TestingModule,
  ],
})
export class ModulesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationService } from './authorization.service';
import { PlatformRoleAssignment } from './entities/platform-role-assignment.entity';
import { RoleAssignment } from './entities/role-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformRoleAssignment, RoleAssignment])],
  controllers: [AuthorizationController],
  providers: [AuthorizationService, AuthorizationRepository],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}

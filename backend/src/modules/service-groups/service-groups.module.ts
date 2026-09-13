import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ServiceGroup } from './entities/service-group.entity';
import { ServiceGroupsController } from './service-groups.controller';
import { ServiceGroupsRepository } from './service-groups.repository';
import { ServiceGroupsService } from './service-groups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceGroup]),
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [ServiceGroupsController],
  providers: [ServiceGroupsService, ServiceGroupsRepository],
})
export class ServiceGroupsModule {}

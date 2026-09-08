import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Branch } from '../branches/entities/branch.entity';
import { AuditLogQueryService } from './audit-log-query.service';
import { AuditLogRepository } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';
import {
  BranchAuditLogsController,
  PlatformAuditLogsController,
  TenantAuditLogsController,
} from './audit-logs.controller';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Branch]), AuthorizationModule],
  controllers: [
    PlatformAuditLogsController,
    TenantAuditLogsController,
    BranchAuditLogsController,
  ],
  providers: [AuditLogService, AuditLogRepository, AuditLogQueryService],
  exports: [AuditLogService],
})
export class AuditModule {}

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { PlatformScope } from '../../common/decorators/platform-scope.decorator';
import { AllowInactiveBranchAccess } from '../../common/decorators/allow-inactive-branch-access.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { TenantScope } from '../../common/decorators/tenant-scope.decorator';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { AuditLogQueryService } from './audit-log-query.service';

@Controller('platform/audit-logs')
export class PlatformAuditLogsController {
  constructor(private readonly auditLogQueryService: AuditLogQueryService) {}

  @Get()
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_AUDIT_LOG_READ)
  list(@Query() query: ListAuditLogsDto) {
    return this.auditLogQueryService.listPlatform(query);
  }

  @Get(':id')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_AUDIT_LOG_READ)
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditLogQueryService.getPlatform(id);
  }
}

@Controller('tenants/:tenantSlug/audit-logs')
export class TenantAuditLogsController {
  constructor(private readonly auditLogQueryService: AuditLogQueryService) {}

  @Get()
  @TenantScope('tenant')
  @RequirePermissions(Permission.AUDIT_LOG_READ)
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListAuditLogsDto,
  ) {
    return this.auditLogQueryService.listTenant(context, query);
  }

  @Get(':id')
  @TenantScope('tenant')
  @RequirePermissions(Permission.AUDIT_LOG_READ)
  getOne(
    @RequestContext() context: AuthorizationContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.auditLogQueryService.getTenant(context, id);
  }
}

@Controller('tenants/:tenantSlug/branches/:branchSlug/audit-logs')
export class BranchAuditLogsController {
  constructor(private readonly auditLogQueryService: AuditLogQueryService) {}

  @Get()
  @AllowInactiveBranchAccess()
  @TenantScope('branch')
  @RequirePermissions(Permission.AUDIT_LOG_READ)
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListAuditLogsDto,
  ) {
    return this.auditLogQueryService.listBranch(context, query);
  }

  @Get(':id')
  @AllowInactiveBranchAccess()
  @TenantScope('branch')
  @RequirePermissions(Permission.AUDIT_LOG_READ)
  getOne(
    @RequestContext() context: AuthorizationContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.auditLogQueryService.getBranch(context, id);
  }
}

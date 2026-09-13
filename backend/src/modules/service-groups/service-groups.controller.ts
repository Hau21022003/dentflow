import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScope } from '../../common/decorators/tenant-scope.decorator';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { CreateServiceGroupDto } from './dto/create-service-group.dto';
import { ListServiceGroupsQueryDto } from './dto/list-service-groups-query.dto';
import { ServiceGroupReasonDto } from './dto/service-group-reason.dto';
import { UpdateServiceGroupDto } from './dto/update-service-group.dto';
import { ServiceGroupsService } from './service-groups.service';

@Controller('tenants/:tenantSlug/service-groups')
export class ServiceGroupsController {
  constructor(private readonly serviceGroupsService: ServiceGroupsService) {}

  @Get()
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListServiceGroupsQueryDto,
  ) {
    return this.serviceGroupsService.list(context, query);
  }

  @Get(':serviceGroupId')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  get(
    @RequestContext() context: AuthorizationContext,
    @Param('serviceGroupId', ParseUUIDPipe) serviceGroupId: string,
  ) {
    return this.serviceGroupsService.get(context, serviceGroupId);
  }

  @Post()
  @Idempotent('tenant.service-group.create')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  create(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreateServiceGroupDto,
  ) {
    return this.serviceGroupsService.create(context, body);
  }

  @Patch(':serviceGroupId')
  @Idempotent('tenant.service-group.update')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('serviceGroupId', ParseUUIDPipe) serviceGroupId: string,
    @Body() body: UpdateServiceGroupDto,
  ) {
    return this.serviceGroupsService.update(context, serviceGroupId, body);
  }

  @Post(':serviceGroupId/deactivate')
  @HttpCode(HttpStatus.OK)
  @Idempotent('tenant.service-group.deactivate')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  deactivate(
    @RequestContext() context: AuthorizationContext,
    @Param('serviceGroupId', ParseUUIDPipe) serviceGroupId: string,
    @Body() body: ServiceGroupReasonDto,
  ) {
    return this.serviceGroupsService.deactivate(
      context,
      serviceGroupId,
      body.reason,
    );
  }

  @Post(':serviceGroupId/activate')
  @HttpCode(HttpStatus.OK)
  @Idempotent('tenant.service-group.activate')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  activate(
    @RequestContext() context: AuthorizationContext,
    @Param('serviceGroupId', ParseUUIDPipe) serviceGroupId: string,
    @Body() body: ServiceGroupReasonDto,
  ) {
    return this.serviceGroupsService.activate(
      context,
      serviceGroupId,
      body.reason,
    );
  }
}

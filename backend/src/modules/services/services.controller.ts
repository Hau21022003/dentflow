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
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { ServiceReasonDto } from './dto/service-reason.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@Controller('tenants/:tenantSlug/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListServicesQueryDto,
  ) {
    return this.servicesService.list(context, query);
  }

  @Get(':serviceId')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  get(
    @RequestContext() context: AuthorizationContext,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.servicesService.get(context, serviceId);
  }

  @Post()
  @Idempotent('tenant.service.create')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  create(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreateServiceDto,
  ) {
    return this.servicesService.create(context, body);
  }

  @Patch(':serviceId')
  @Idempotent('tenant.service.update')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: UpdateServiceDto,
  ) {
    return this.servicesService.update(context, serviceId, body);
  }

  @Post(':serviceId/deactivate')
  @HttpCode(HttpStatus.OK)
  @Idempotent('tenant.service.deactivate')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  deactivate(
    @RequestContext() context: AuthorizationContext,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: ServiceReasonDto,
  ) {
    return this.servicesService.deactivate(context, serviceId, body.reason);
  }

  @Post(':serviceId/activate')
  @HttpCode(HttpStatus.OK)
  @Idempotent('tenant.service.activate')
  @TenantScope('tenant')
  @RequirePermissions(Permission.SERVICE_CATALOG_MANAGE)
  activate(
    @RequestContext() context: AuthorizationContext,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: ServiceReasonDto,
  ) {
    return this.servicesService.activate(context, serviceId, body.reason);
  }
}

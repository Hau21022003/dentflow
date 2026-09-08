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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PlatformScope } from '../../common/decorators/platform-scope.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { AcceptTenantOwnerInvitationDto } from './dto/accept-tenant-owner-invitation.dto';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import { ListPlatformTenantsQueryDto } from './dto/list-platform-tenants-query.dto';
import {
  ExtendTenantTrialDto,
  LifecycleReasonDto,
} from './dto/tenant-lifecycle.dto';
import { UpdatePlatformTenantDto } from './dto/update-platform-tenant.dto';
import { TenantsService } from './tenants.service';

type OptionalAuthenticatedRequest = Request & { user?: AccessTokenPayload };

@ApiTags('Platform tenants')
@Controller()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('platform/tenants')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  list(@Query() query: ListPlatformTenantsQueryDto) {
    return this.tenantsService.list(query);
  }

  @Get('platform/tenants/:tenantId')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  get(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.tenantsService.getPlatformDetail(tenantId);
  }

  @Post('platform/tenants')
  @Idempotent('platform.tenant.create')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  create(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreatePlatformTenantDto,
  ) {
    return this.tenantsService.create(context, body);
  }

  @Patch('platform/tenants/:tenantId')
  @Idempotent('platform.tenant.update')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: UpdatePlatformTenantDto,
  ) {
    return this.tenantsService.update(context, tenantId, body);
  }

  @Post('platform/tenants/:tenantId/resend-owner-invite')
  @Idempotent('platform.tenant.owner-invitation.resend')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  resendOwnerInvite(
    @RequestContext() context: AuthorizationContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.tenantsService.resendOwnerInvitation(context, tenantId);
  }

  @Post('platform/tenants/:tenantId/extend-trial')
  @Idempotent('platform.tenant.trial.extend')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  extendTrial(
    @RequestContext() context: AuthorizationContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: ExtendTenantTrialDto,
  ) {
    return this.tenantsService.extendTrial(
      context,
      tenantId,
      body.days,
      body.reason,
    );
  }

  @Post('platform/tenants/:tenantId/suspend')
  @Idempotent('platform.tenant.suspend')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  suspend(
    @RequestContext() context: AuthorizationContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: LifecycleReasonDto,
  ) {
    return this.tenantsService.suspend(context, tenantId, body.reason);
  }

  @Post('platform/tenants/:tenantId/reactivate')
  @Idempotent('platform.tenant.reactivate')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
  reactivate(
    @RequestContext() context: AuthorizationContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: LifecycleReasonDto,
  ) {
    return this.tenantsService.reactivate(context, tenantId, body.reason);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('auth/tenant-owner-invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE)
  acceptOwnerInvitation(
    @Body() body: AcceptTenantOwnerInvitationDto,
    @Req() request: OptionalAuthenticatedRequest,
  ) {
    return this.tenantsService.acceptOwnerInvitation(body, request.user?.sub);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScope } from '../../common/decorators/tenant-scope.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import type { AccessTokenPayload } from '../auth/auth.types';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { AcceptStaffInvitationDto } from './dto/accept-staff-invitation.dto';
import { CreateStaffInvitationDto } from './dto/create-staff-invitation.dto';
import { GrantRoleAssignmentsDto } from './dto/grant-role-assignments.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { StaffReasonDto } from './dto/staff-reason.dto';
import { StaffService } from './staff.service';

type OptionalAuthenticatedRequest = Request & { user?: AccessTokenPayload };

@Controller()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('tenants/:tenantSlug/staff')
  @TenantScope('tenant')
  @RequirePermissions(Permission.STAFF_MANAGE)
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListStaffQueryDto,
  ) {
    return this.staffService.list(context, query);
  }

  @Post('tenants/:tenantSlug/staff/invitations')
  @Idempotent('tenant.staff.invitation.create')
  @TenantScope('tenant')
  @RequirePermissions(Permission.STAFF_MANAGE)
  createInvitation(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreateStaffInvitationDto,
  ) {
    return this.staffService.createInvitation(context, body);
  }

  @Post('tenants/:tenantSlug/staff/invitations/:invitationId/resend')
  @Idempotent('tenant.staff.invitation.resend')
  @TenantScope('tenant')
  @RequirePermissions(Permission.STAFF_MANAGE)
  resendInvitation(
    @RequestContext() context: AuthorizationContext,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.staffService.resendInvitation(context, invitationId);
  }

  @Post('tenants/:tenantSlug/staff/invitations/:invitationId/revoke')
  @Idempotent('tenant.staff.invitation.revoke')
  @TenantScope('tenant')
  @RequirePermissions(Permission.STAFF_MANAGE)
  revokeInvitation(
    @RequestContext() context: AuthorizationContext,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @Body() body: StaffReasonDto,
  ) {
    return this.staffService.revokeInvitation(
      context,
      invitationId,
      body.reason,
    );
  }

  @Post('tenants/:tenantSlug/staff/:userId/disable')
  @Idempotent('tenant.staff.disable')
  @TenantScope('tenant')
  @RequirePermissions(Permission.STAFF_MANAGE)
  disable(
    @RequestContext() context: AuthorizationContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: StaffReasonDto,
  ) {
    return this.staffService.disable(context, userId, body.reason);
  }

  @Post('tenants/:tenantSlug/staff/:userId/enable')
  @Idempotent('tenant.staff.enable')
  @TenantScope('tenant')
  @RequirePermissions(Permission.STAFF_MANAGE)
  enable(
    @RequestContext() context: AuthorizationContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: StaffReasonDto,
  ) {
    return this.staffService.enable(context, userId, body.reason);
  }

  @Post('tenants/:tenantSlug/staff/:userId/role-assignments')
  @Idempotent('tenant.staff.role-grant')
  @TenantScope('tenant')
  @RequirePermissions(Permission.STAFF_MANAGE)
  grantRoles(
    @RequestContext() context: AuthorizationContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: GrantRoleAssignmentsDto,
  ) {
    return this.staffService.grantRoles(context, userId, body);
  }

  @Delete('tenants/:tenantSlug/staff/:userId/role-assignments/:assignmentId')
  @Idempotent('tenant.staff.role-revoke')
  @TenantScope('tenant')
  @RequirePermissions(Permission.STAFF_MANAGE)
  revokeRole(
    @RequestContext() context: AuthorizationContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() body: StaffReasonDto,
  ) {
    return this.staffService.revokeRole(
      context,
      userId,
      assignmentId,
      body.reason,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('auth/staff-invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE)
  acceptInvitation(
    @Body() body: AcceptStaffInvitationDto,
    @Req() request: OptionalAuthenticatedRequest,
  ) {
    return this.staffService.acceptInvitation(body, request.user?.sub);
  }
}

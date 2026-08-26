import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { PlatformScope } from 'src/common/decorators/platform-scope.decorator';
import { RequestContext } from 'src/common/decorators/request-context.decorator';
import { RequirePermissions } from 'src/common/decorators/require-permissions.decorator';
import { TenantScope } from 'src/common/decorators/tenant-scope.decorator';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { TestingGuard } from './testing.guard';

@Controller('testing/authorization')
@UseGuards(TestingGuard)
export class AuthorizationTestingController {
  @Get('jwt-only')
  jwtOnly(@CurrentUserId() userId: string) {
    return { userId };
  }

  @Get('platform')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_SYSTEM_READ)
  platform(@RequestContext() context: AuthorizationContext) {
    return { context };
  }

  @Get('tenants/:tenantSlug')
  @TenantScope('tenant')
  @RequirePermissions(Permission.TENANT_SETTINGS_MANAGE)
  tenant(@RequestContext() context: AuthorizationContext) {
    return { context };
  }

  @Get('tenants/:tenantSlug/branches/:branchSlug')
  @TenantScope('branch')
  @RequirePermissions(
    Permission.APPOINTMENT_MANAGE,
    Permission.CLINICAL_VISIT_WRITE,
  )
  branch(@RequestContext() context: AuthorizationContext) {
    return { context };
  }
}

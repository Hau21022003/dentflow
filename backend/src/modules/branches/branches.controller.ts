import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { BranchesService } from './branches.service';
import { ActivateBranchDto } from './dto/activate-branch.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { DeactivateBranchDto } from './dto/deactivate-branch.dto';
import { ListBranchesQueryDto } from './dto/list-branches-query.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('tenants/:tenantSlug/branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @TenantScope('tenant')
  @RequirePermissions(Permission.BRANCH_MANAGE)
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListBranchesQueryDto,
  ) {
    return this.branchesService.list(context, query);
  }

  @Post()
  @Idempotent('tenant.branch.create')
  @TenantScope('tenant')
  @RequirePermissions(Permission.BRANCH_MANAGE)
  create(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreateBranchDto,
  ) {
    return this.branchesService.create(context, body);
  }

  @Patch(':branchSlug')
  @Idempotent('tenant.branch.update')
  @TenantScope('tenant')
  @RequirePermissions(Permission.BRANCH_MANAGE)
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('branchSlug') branchSlug: string,
    @Body() body: UpdateBranchDto,
  ) {
    return this.branchesService.update(context, branchSlug, body);
  }

  @Post(':branchSlug/deactivate')
  @HttpCode(HttpStatus.OK)
  @Idempotent('tenant.branch.deactivate')
  @TenantScope('tenant')
  @RequirePermissions(Permission.BRANCH_MANAGE)
  deactivate(
    @RequestContext() context: AuthorizationContext,
    @Param('branchSlug') branchSlug: string,
    @Body() body: DeactivateBranchDto,
  ) {
    return this.branchesService.deactivate(context, branchSlug, body.reason);
  }

  @Post(':branchSlug/activate')
  @HttpCode(HttpStatus.OK)
  @Idempotent('tenant.branch.activate')
  @TenantScope('tenant')
  @RequirePermissions(Permission.BRANCH_MANAGE)
  activate(
    @RequestContext() context: AuthorizationContext,
    @Param('branchSlug') branchSlug: string,
    @Body() body: ActivateBranchDto,
  ) {
    return this.branchesService.activate(context, branchSlug, body.reason);
  }
}

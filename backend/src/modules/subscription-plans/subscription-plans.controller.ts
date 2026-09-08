import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PlatformScope } from '../../common/decorators/platform-scope.decorator';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@Controller('platform/plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_PLAN_MANAGE)
  list() {
    return this.subscriptionPlansService.list();
  }

  @Post()
  @Idempotent('platform.plan.create')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_PLAN_MANAGE)
  create(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreateSubscriptionPlanDto,
  ) {
    return this.subscriptionPlansService.create(context, body);
  }

  @Patch(':planId')
  @Idempotent('platform.plan.update')
  @PlatformScope()
  @RequirePermissions(Permission.PLATFORM_PLAN_MANAGE)
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() body: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionPlansService.update(context, planId, body);
  }
}

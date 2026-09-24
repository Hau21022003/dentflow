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
import { ListTreatmentItemEventsDto } from './dto/list-treatment-item-events.dto';
import { ListTreatmentPlansQueryDto } from './dto/list-treatment-plans-query.dto';
import { RecordTreatmentItemEventDto } from './dto/record-treatment-item-event.dto';
import { SyncTreatmentPlanDto } from './dto/sync-treatment-plan.dto';
import { TreatmentReasonDto } from './dto/treatment-reason.dto';
import { TreatmentPlansService } from './treatment-plans.service';
import { ListTreatmentPlanAcceptancesQueryDto } from './dto/list-treatment-plan-acceptances-query.dto';
import { TreatmentPlanAcceptanceService } from './treatment-plan-acceptance.service';

@Controller(
  'tenants/:tenantSlug/branches/:branchSlug/visits/:visitId/treatment-plans',
)
@TenantScope('branch')
@RequirePermissions(Permission.TREATMENT_PLAN_WRITE)
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}
  @Get() list(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Query() query: ListTreatmentPlansQueryDto,
  ) {
    return this.service.list(context, visitId, query);
  }
  @Post() @Idempotent('clinical.treatment-plan.create') create(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
  ) {
    return this.service.create(context, visitId);
  }
  @Get(':planId') get(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.service.get(context, visitId, planId);
  }
  @Patch(':planId') @Idempotent('clinical.treatment-plan.draft-sync') sync(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() body: SyncTreatmentPlanDto,
  ) {
    return this.service.sync(context, visitId, planId, body);
  }
  @Post(':planId/propose')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.treatment-plan.propose')
  propose(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.service.propose(context, visitId, planId);
  }
  @Post(':planId/reopen')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.treatment-plan.reopen')
  reopen(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() body: TreatmentReasonDto,
  ) {
    return this.service.reopen(context, visitId, planId, body);
  }
  @Post(':planId/cancel')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.treatment-plan.cancel')
  cancel(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() body: TreatmentReasonDto,
  ) {
    return this.service.cancel(context, visitId, planId, body);
  }
  @Get(':planId/items/:itemId/events') events(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query() query: ListTreatmentItemEventsDto,
  ) {
    return this.service.listEvents(context, visitId, planId, itemId, query);
  }
  @Post(':planId/items/:itemId/events')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.treatment-item.event.record')
  @RequirePermissions(
    Permission.TREATMENT_PLAN_WRITE,
    Permission.TREATMENT_ITEM_EXECUTE,
  )
  recordEvent(
    @RequestContext() context: AuthorizationContext,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: RecordTreatmentItemEventDto,
  ) {
    return this.service.recordEvent(context, visitId, planId, itemId, body);
  }
}

@Controller('tenants/:tenantSlug/branches/:branchSlug')
@TenantScope('branch')
@RequirePermissions(Permission.TREATMENT_PLAN_ACCEPT)
export class TreatmentPlanAcceptanceController {
  constructor(private readonly service: TreatmentPlanAcceptanceService) {}
  @Get('treatment-plan-acceptances')
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListTreatmentPlanAcceptancesQueryDto,
  ) {
    return this.service.list(context, query);
  }
  @Post('treatment-plans/:planId/accept')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.treatment-plan.accept')
  accept(
    @RequestContext() context: AuthorizationContext,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.service.accept(context, planId);
  }
}

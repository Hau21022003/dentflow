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
} from '@nestjs/common';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScope } from '../../common/decorators/tenant-scope.decorator';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { Permission } from '../authorization/authorization.policy';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { CreateTreatmentNoteDto } from './dto/create-treatment-note.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { VisitsService } from './visits.service';

@Controller('tenants/:tenantSlug/branches/:branchSlug/appointments')
@TenantScope('branch')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post(':appointmentId/start')
  @Idempotent('clinical.visit.start')
  @RequirePermissions(Permission.CLINICAL_VISIT_WRITE)
  start(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.visitsService.start(context, appointmentId);
  }

  @Get(':appointmentId/visit')
  @RequirePermissions(Permission.CLINICAL_VISIT_WRITE)
  get(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.visitsService.get(context, appointmentId);
  }

  @Patch(':appointmentId/visit')
  @Idempotent('clinical.visit.update')
  @RequirePermissions(Permission.CLINICAL_VISIT_WRITE)
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() body: UpdateVisitDto,
  ) {
    return this.visitsService.update(context, appointmentId, body);
  }

  @Post(':appointmentId/visit/complete')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.visit.complete')
  @RequirePermissions(Permission.CLINICAL_VISIT_WRITE)
  complete(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.visitsService.complete(context, appointmentId);
  }

  @Post(':appointmentId/visit/addenda')
  @Idempotent('clinical.visit.addendum.create')
  @RequirePermissions(Permission.CLINICAL_VISIT_WRITE)
  addendum(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() body: CreateTreatmentNoteDto,
  ) {
    return this.visitsService.addendum(context, appointmentId, body);
  }
}

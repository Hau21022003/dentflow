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
import { CreatePatientDto } from './dto/create-patient.dto';
import { ListPatientAppointmentsQueryDto } from './dto/list-patient-appointments-query.dto';
import { ListPatientVisitsQueryDto } from './dto/list-patient-visits-query.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import {
  CreatePatientAlertDto,
  ResolvePatientAlertDto,
  UpdatePatientAlertDto,
} from './dto/patient-alert.dto';
import { PatientAlertsService } from './patient-alerts.service';
import { PatientAppointmentsService } from './patient-appointments.service';
import { PatientDetailsService } from './patient-details.service';
import { PatientVisitsService } from './patient-visits.service';
import { PatientsService } from './patients.service';

@Controller('tenants/:tenantSlug/branches/:branchSlug/patients')
@TenantScope('branch')
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly patientAlertsService: PatientAlertsService,
    private readonly patientAppointmentsService: PatientAppointmentsService,
    private readonly patientVisitsService: PatientVisitsService,
    private readonly patientDetailsService: PatientDetailsService,
  ) {}

  @Get()
  @RequirePermissions(Permission.PATIENT_ADMINISTRATIVE_MANAGE)
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListPatientsQueryDto,
  ) {
    return this.patientsService.list(context, query);
  }

  @Get('assigned')
  @RequirePermissions(Permission.APPOINTMENT_ASSIGNED_READ)
  listAssigned(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListPatientsQueryDto,
  ) {
    return this.patientsService.listAssigned(context, query);
  }

  @Get(':patientId/appointments')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  listAppointments(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: ListPatientAppointmentsQueryDto,
  ) {
    return this.patientAppointmentsService.list(context, patientId, query);
  }

  @Get(':patientId/visits')
  @RequirePermissions(Permission.PATIENT_CLINICAL_READ)
  listVisits(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: ListPatientVisitsQueryDto,
  ) {
    return this.patientVisitsService.list(context, patientId, query);
  }

  @Get(':patientId')
  @RequirePermissions(Permission.PATIENT_ADMINISTRATIVE_MANAGE)
  get(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.patientsService.get(context, patientId);
  }

  @Get(':patientId/overview')
  @RequirePermissions(
    Permission.PATIENT_ADMINISTRATIVE_MANAGE,
    Permission.PATIENT_CLINICAL_READ,
  )
  overview(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.patientDetailsService.getOverview(context, patientId);
  }

  @Get(':patientId/treatment-plans/:planId')
  @RequirePermissions(
    Permission.PATIENT_ADMINISTRATIVE_MANAGE,
    Permission.PATIENT_CLINICAL_READ,
  )
  getTreatmentPlan(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.patientDetailsService.getTreatmentPlan(
      context,
      patientId,
      planId,
    );
  }

  @Get(':patientId/alerts')
  @RequirePermissions(Permission.PATIENT_ALERT_MANAGE)
  listAlerts(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.patientAlertsService.list(context, patientId);
  }

  @Post(':patientId/alerts')
  @Idempotent('clinical.patient-alert.create')
  @RequirePermissions(Permission.PATIENT_ALERT_MANAGE)
  createAlert(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() body: CreatePatientAlertDto,
  ) {
    return this.patientAlertsService.create(context, patientId, body);
  }

  @Patch(':patientId/alerts/:alertId')
  @Idempotent('clinical.patient-alert.update')
  @RequirePermissions(Permission.PATIENT_ALERT_MANAGE)
  updateAlert(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @Body() body: UpdatePatientAlertDto,
  ) {
    return this.patientAlertsService.update(context, patientId, alertId, body);
  }

  @Post(':patientId/alerts/:alertId/resolve')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.patient-alert.resolve')
  @RequirePermissions(Permission.PATIENT_ALERT_MANAGE)
  resolveAlert(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @Body() body: ResolvePatientAlertDto,
  ) {
    return this.patientAlertsService.resolve(
      context,
      patientId,
      alertId,
      body.reasonCode,
    );
  }

  @Post()
  @Idempotent('clinical.patient.create')
  @RequirePermissions(Permission.PATIENT_ADMINISTRATIVE_MANAGE)
  create(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreatePatientDto,
  ) {
    return this.patientsService.create(context, body);
  }

  @Patch(':patientId')
  @Idempotent('clinical.patient.update')
  @RequirePermissions(Permission.PATIENT_ADMINISTRATIVE_MANAGE)
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() body: UpdatePatientDto,
  ) {
    return this.patientsService.update(context, patientId, body);
  }
}

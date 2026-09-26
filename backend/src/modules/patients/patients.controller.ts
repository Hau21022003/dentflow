import {
  Body,
  Controller,
  Get,
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
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@Controller('tenants/:tenantSlug/branches/:branchSlug/patients')
@TenantScope('branch')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

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

  @Get(':patientId')
  @RequirePermissions(Permission.PATIENT_ADMINISTRATIVE_MANAGE)
  get(
    @RequestContext() context: AuthorizationContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.patientsService.get(context, patientId);
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

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
import { CreatePatientFileDto } from './dto/create-patient-file.dto';
import { ListPatientFilesQueryDto } from './dto/list-patient-files-query.dto';
import { PatientFileAccessQueryDto } from './dto/patient-file-access-query.dto';
import { UpdatePatientFileDto } from './dto/update-patient-file.dto';
import { PatientFilesService } from './patient-files.service';

@Controller(
  'tenants/:tenantSlug/branches/:branchSlug/appointments/:appointmentId/visit/files',
)
@TenantScope('branch')
@RequirePermissions(Permission.CLINICAL_VISIT_WRITE)
export class PatientFilesController {
  constructor(private readonly service: PatientFilesService) {}

  @Get()
  list(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Query() query: ListPatientFilesQueryDto,
  ) {
    return this.service.list(context, appointmentId, query);
  }

  @Post()
  @Idempotent('clinical.patient-file.create')
  create(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() body: CreatePatientFileDto,
  ) {
    return this.service.create(context, appointmentId, body);
  }

  @Patch(':fileId')
  @Idempotent('clinical.patient-file.update')
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() body: UpdatePatientFileDto,
  ) {
    return this.service.update(context, appointmentId, fileId, body);
  }

  @Post(':fileId/archive')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.patient-file.archive')
  archive(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.service.archive(context, appointmentId, fileId);
  }

  @Get(':fileId/access')
  access(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query() query: PatientFileAccessQueryDto,
  ) {
    return this.service.access(context, appointmentId, fileId, query);
  }
}

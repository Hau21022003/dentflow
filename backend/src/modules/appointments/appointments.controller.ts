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
import { AppointmentsService } from './appointments.service';
import { AssignAppointmentDto } from './dto/assign-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { GetAppointmentCalendarSummaryQueryDto } from './dto/get-appointment-calendar-summary-query.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { ListAppointmentBookingOptionsQueryDto } from './dto/list-appointment-booking-options-query.dto';
import { NoShowAppointmentDto } from './dto/no-show-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller('tenants/:tenantSlug/branches/:branchSlug/appointments')
@TenantScope('branch')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  list(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointmentsService.list(context, query);
  }

  @Get('assigned')
  @RequirePermissions(Permission.APPOINTMENT_ASSIGNED_READ)
  listAssigned(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointmentsService.listAssigned(context, query);
  }

  @Get('booking-options/dentists')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  listBookingDentists(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListAppointmentBookingOptionsQueryDto,
  ) {
    return this.appointmentsService.listBookingDentists(context, query);
  }

  @Get('booking-options/services')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  listBookingServices(
    @RequestContext() context: AuthorizationContext,
    @Query() query: ListAppointmentBookingOptionsQueryDto,
  ) {
    return this.appointmentsService.listBookingServices(context, query);
  }

  @Get('calendar-summary')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  calendarSummary(
    @RequestContext() context: AuthorizationContext,
    @Query() query: GetAppointmentCalendarSummaryQueryDto,
  ) {
    return this.appointmentsService.calendarSummary(context, query.month);
  }

  @Get(':appointmentId')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  get(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.appointmentsService.get(context, appointmentId);
  }

  @Post()
  @Idempotent('clinical.appointment.create')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  create(
    @RequestContext() context: AuthorizationContext,
    @Body() body: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(context, body);
  }

  @Patch(':appointmentId')
  @Idempotent('clinical.appointment.update')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  update(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() body: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(context, appointmentId, body);
  }

  @Post(':appointmentId/confirm')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.appointment.confirm')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  confirm(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.appointmentsService.confirm(context, appointmentId);
  }

  @Post(':appointmentId/check-in')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.appointment.check-in')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  checkIn(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.appointmentsService.checkIn(context, appointmentId);
  }

  @Post(':appointmentId/assign')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.appointment.assign')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  assign(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() body: AssignAppointmentDto,
  ) {
    return this.appointmentsService.assign(context, appointmentId, body);
  }

  @Post(':appointmentId/cancel')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.appointment.cancel')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  cancel(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() body: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(
      context,
      appointmentId,
      body.reasonCode,
    );
  }

  @Post(':appointmentId/no-show')
  @HttpCode(HttpStatus.OK)
  @Idempotent('clinical.appointment.no-show')
  @RequirePermissions(Permission.APPOINTMENT_MANAGE)
  noShow(
    @RequestContext() context: AuthorizationContext,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() body: NoShowAppointmentDto,
  ) {
    return this.appointmentsService.noShow(
      context,
      appointmentId,
      body.reasonCode,
    );
  }
}

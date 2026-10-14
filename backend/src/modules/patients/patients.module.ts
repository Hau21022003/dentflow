import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Patient } from './entities/patient.entity';
import { PatientAlert } from './entities/patient-alert.entity';
import { PatientAlertsService } from './patient-alerts.service';
import { PatientAppointmentsService } from './patient-appointments.service';
import { PatientDetailsService } from './patient-details.service';
import { PatientsController } from './patients.controller';
import { PatientsRepository } from './patients.repository';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, PatientAlert, Appointment]),
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [PatientsController],
  providers: [
    PatientsService,
    PatientAlertsService,
    PatientAppointmentsService,
    PatientDetailsService,
    PatientsRepository,
  ],
})
export class PatientsModule {}

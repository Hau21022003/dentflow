import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Patient } from './entities/patient.entity';
import { PatientAlert } from './entities/patient-alert.entity';
import { PatientAlertsService } from './patient-alerts.service';
import { PatientDetailsService } from './patient-details.service';
import { PatientsController } from './patients.controller';
import { PatientsRepository } from './patients.repository';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, PatientAlert]),
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [PatientsController],
  providers: [
    PatientsService,
    PatientAlertsService,
    PatientDetailsService,
    PatientsRepository,
  ],
})
export class PatientsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../../infrastructure/storage';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Visit } from '../visits/entities/visit.entity';
import { PatientFile } from './entities/patient-file.entity';
import { PatientFilesController } from './patient-files.controller';
import { PatientFilesService } from './patient-files.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientFile, Visit]),
    AppointmentsModule,
    AuditModule,
    AuthorizationModule,
    StorageModule,
  ],
  controllers: [PatientFilesController],
  providers: [PatientFilesService],
})
export class PatientFilesModule {}

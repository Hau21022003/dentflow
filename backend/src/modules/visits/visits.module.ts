import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { VisitsController } from './visits.controller';
import { TreatmentNote } from './entities/treatment-note.entity';
import { Visit } from './entities/visit.entity';
import { VisitsRepository } from './visits.repository';
import { VisitsService } from './visits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Visit, TreatmentNote]),
    AppointmentsModule,
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [VisitsController],
  providers: [VisitsService, VisitsRepository],
})
export class VisitsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { TreatmentItemEvent } from './entities/treatment-item-event.entity';
import { TreatmentItem } from './entities/treatment-item.entity';
import { TreatmentPlan } from './entities/treatment-plan.entity';
import { Patient } from '../patients/entities/patient.entity';
import {
  TreatmentPlanAcceptanceController,
  TreatmentPlansController,
} from './treatment-plans.controller';
import { TreatmentPlansRepository } from './treatment-plans.repository';
import { TreatmentPlansService } from './treatment-plans.service';
import { TreatmentPlanAcceptanceService } from './treatment-plan-acceptance.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TreatmentPlan,
      TreatmentItem,
      TreatmentItemEvent,
      Patient,
    ]),
    AppointmentsModule,
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [TreatmentPlansController, TreatmentPlanAcceptanceController],
  providers: [
    TreatmentPlansService,
    TreatmentPlanAcceptanceService,
    TreatmentPlansRepository,
  ],
})
export class TreatmentPlansModule {}

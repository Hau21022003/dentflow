import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Patient } from './entities/patient.entity';
import { PatientsController } from './patients.controller';
import { PatientsRepository } from './patients.repository';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient]),
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsRepository],
})
export class PatientsModule {}

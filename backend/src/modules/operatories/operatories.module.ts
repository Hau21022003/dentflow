import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Operatory } from './entities/operatory.entity';
import { OperatoriesController } from './operatories.controller';
import { OperatoriesService } from './operatories.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Operatory]),
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [OperatoriesController],
  providers: [OperatoriesService],
  exports: [OperatoriesService],
})
export class OperatoriesModule {}

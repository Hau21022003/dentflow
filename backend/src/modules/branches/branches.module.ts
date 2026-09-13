import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Branch } from './entities/branch.entity';
import { BranchesController } from './branches.controller';
import { BranchesRepository } from './branches.repository';
import { BranchesService } from './branches.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch]),
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [BranchesController],
  providers: [BranchesService, BranchesRepository],
})
export class BranchesModule {}

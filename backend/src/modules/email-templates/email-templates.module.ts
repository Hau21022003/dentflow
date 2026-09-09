import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EmailTemplateRenderer } from './email-template-renderer.service';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplateRevision } from './entities/email-template-revision.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailTemplateRevision]),
    AuditModule,
    AuthorizationModule,
  ],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService, EmailTemplateRenderer],
  exports: [EmailTemplatesService, EmailTemplateRenderer],
})
export class EmailTemplatesModule {}

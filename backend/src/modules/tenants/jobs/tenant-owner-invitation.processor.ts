import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../../../config/app-config.service';
import { EMAIL_SENDER, type EmailSender } from '../../../infrastructure/email';
import {
  EmailTemplateRenderError,
  EmailTemplateRenderer,
} from '../../email-templates/email-template-renderer.service';
import {
  EmailTemplateKey,
  EmailTemplateLocale,
  normalizeEmailTemplateLocale,
} from '../../email-templates/email-template-registry';
import {
  SendTenantOwnerInvitationJob,
  TenantInvitationJobName,
  TenantInvitationQueueName,
} from './tenant-owner-invitation.types';
import {
  TenantOwnerInvitation,
  TenantOwnerInvitationDeliveryStatus,
  TenantOwnerInvitationStatus,
} from '../entities/tenant-owner-invitation.entity';
import { TenantInvitationTokenService } from '../tenant-invitation-token.service';

@Processor(TenantInvitationQueueName)
@Injectable()
export class TenantOwnerInvitationProcessor extends WorkerHost {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    private readonly appConfig: AppConfigService,
    private readonly tokenService: TenantInvitationTokenService,
    private readonly emailTemplateRenderer: EmailTemplateRenderer,
  ) {
    super();
  }

  async process(job: Job<SendTenantOwnerInvitationJob>): Promise<void> {
    if (job.name !== TenantInvitationJobName.SEND_OWNER_INVITATION) {
      throw new Error('Unsupported tenant invitation notification job.');
    }

    const invitation = await this.dataSource
      .getRepository(TenantOwnerInvitation)
      .findOne({
        where: { id: job.data.invitationId },
        relations: { tenant: true },
      });
    if (
      !invitation ||
      invitation.status !== TenantOwnerInvitationStatus.PENDING
    ) {
      return;
    }
    if (invitation.expiresAt <= new Date()) {
      await this.markFailed(invitation.id, 'INVITATION_EXPIRED');
      return;
    }

    try {
      const token = this.tokenService.createToken(invitation);
      const invitationUrl = new URL(
        '/accept-tenant-owner-invitation',
        this.appConfig.corsConfig.frontendOrigin,
      );
      invitationUrl.searchParams.set('token', token);
      const locale = normalizeEmailTemplateLocale(
        invitation.tenant.defaultLocale,
      );
      const renderedTemplate = await this.emailTemplateRenderer.renderPublished(
        EmailTemplateKey.TENANT_OWNER_INVITATION,
        locale,
        {
          tenantDisplayName: invitation.tenant.displayName,
          invitationUrl: invitationUrl.toString(),
          expiresAt: new Intl.DateTimeFormat(
            locale === EmailTemplateLocale.EN ? 'en-US' : 'vi-VN',
            {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: invitation.tenant.defaultTimezone,
            },
          ).format(invitation.expiresAt),
        },
      );
      await this.emailSender.send({
        to: [invitation.ownerEmail],
        ...renderedTemplate,
      });
      await this.dataSource
        .getRepository(TenantOwnerInvitation)
        .update(invitation.id, {
          deliveryStatus: TenantOwnerInvitationDeliveryStatus.SENT,
          lastSentAt: new Date(),
          lastDeliveryErrorCode: null,
        });
    } catch (error) {
      if (error instanceof EmailTemplateRenderError) {
        await this.markFailed(invitation.id, error.code);
        return;
      }
      await this.markFailed(invitation.id, 'DELIVERY_FAILED');
      throw error;
    }
  }

  private async markFailed(invitationId: string, code: string): Promise<void> {
    await this.dataSource
      .getRepository(TenantOwnerInvitation)
      .update(invitationId, {
        deliveryStatus: TenantOwnerInvitationDeliveryStatus.FAILED,
        lastDeliveryErrorCode: code,
      });
  }
}

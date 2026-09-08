import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../../../config/app-config.service';
import { EMAIL_SENDER, type EmailSender } from '../../../infrastructure/email';
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
      await this.emailSender.send({
        to: [invitation.ownerEmail],
        subject: `Activate your ${invitation.tenant.displayName} DentFlow account`,
        text: [
          `You were invited to administer ${invitation.tenant.displayName}.`,
          `Activate your account: ${invitationUrl.toString()}`,
          `This invitation expires at ${invitation.expiresAt.toISOString()}.`,
        ].join('\n\n'),
      });
      await this.dataSource
        .getRepository(TenantOwnerInvitation)
        .update(invitation.id, {
          deliveryStatus: TenantOwnerInvitationDeliveryStatus.SENT,
          lastSentAt: new Date(),
          lastDeliveryErrorCode: null,
        });
    } catch (error) {
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

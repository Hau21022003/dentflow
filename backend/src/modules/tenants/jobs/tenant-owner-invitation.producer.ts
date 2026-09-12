import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  SendTenantOwnerInvitationJob,
  TenantInvitationJobName,
  TenantInvitationQueueName,
} from './tenant-owner-invitation.types';

@Injectable()
export class TenantOwnerInvitationProducer {
  constructor(
    @InjectQueue(TenantInvitationQueueName)
    private readonly notificationsQueue: Queue<SendTenantOwnerInvitationJob>,
  ) {}

  async enqueueOwnerInvitation(invitationId: string): Promise<void> {
    await this.notificationsQueue.add(
      TenantInvitationJobName.SEND_OWNER_INVITATION,
      { invitationId },
      {
        jobId: `tenant-owner-invitation-${invitationId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
      },
    );
  }
}

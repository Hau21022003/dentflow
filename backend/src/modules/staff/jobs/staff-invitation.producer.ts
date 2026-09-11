import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  SendStaffInvitationJob,
  StaffInvitationJobName,
  StaffInvitationQueueName,
} from './staff-invitation.types';

@Injectable()
export class StaffInvitationProducer {
  constructor(
    @InjectQueue(StaffInvitationQueueName)
    private readonly notificationsQueue: Queue<SendStaffInvitationJob>,
  ) {}

  async enqueueStaffInvitation(invitationId: string): Promise<void> {
    await this.notificationsQueue.add(
      StaffInvitationJobName.SEND_STAFF_INVITATION,
      { invitationId },
      {
        jobId: `staff-invitation:${invitationId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
      },
    );
  }
}

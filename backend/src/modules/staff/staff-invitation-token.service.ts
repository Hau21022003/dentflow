import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { StaffInvitation } from './entities/staff-invitation.entity';

@Injectable()
export class StaffInvitationTokenService {
  constructor(private readonly config: AppConfigService) {}

  createToken(invitation: StaffInvitation): string {
    const signature = createHmac(
      'sha256',
      this.config.tenantInvitationConfig.tokenSecret,
    )
      .update(this.payload(invitation))
      .digest('base64url');
    return `${invitation.id}.${signature}`;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  matches(invitation: StaffInvitation, token: string): boolean {
    const receivedHash = this.hashToken(token);
    const expectedHash = this.hashToken(this.createToken(invitation));
    return (
      timingSafeEqual(
        Buffer.from(expectedHash, 'hex'),
        Buffer.from(receivedHash, 'hex'),
      ) &&
      timingSafeEqual(
        Buffer.from(invitation.tokenHash, 'hex'),
        Buffer.from(receivedHash, 'hex'),
      )
    );
  }

  getInvitationId(token: string): string | null {
    const [id, signature, ...rest] = token.split('.');
    if (
      rest.length > 0 ||
      !id ||
      !signature ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      ) ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature)
    ) {
      return null;
    }
    return id;
  }

  private payload(invitation: StaffInvitation): string {
    return [
      'staff-invitation-v1',
      invitation.id,
      invitation.tenantId,
      invitation.emailNormalized,
      invitation.expiresAt.toISOString(),
    ].join(':');
  }
}

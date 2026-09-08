import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { TenantOwnerInvitation } from './entities/tenant-owner-invitation.entity';

/**
 * Raw invitation capabilities are deterministic HMACs. PostgreSQL keeps only
 * their SHA-256 digest; the notifications queue therefore never carries a
 * raw token and workers can recreate a link from invitation state alone.
 */
@Injectable()
export class TenantInvitationTokenService {
  constructor(private readonly config: AppConfigService) {}

  createToken(invitation: TenantOwnerInvitation): string {
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

  matches(invitation: TenantOwnerInvitation, token: string): boolean {
    const expectedToken = this.createToken(invitation);
    const expectedHash = this.hashToken(expectedToken);
    const receivedHash = this.hashToken(token);

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

  private payload(invitation: TenantOwnerInvitation): string {
    return [
      'tenant-owner-invitation-v1',
      invitation.id,
      invitation.tenantId,
      invitation.ownerEmailNormalized,
      invitation.expiresAt.toISOString(),
    ].join(':');
  }
}

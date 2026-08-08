import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

@Entity({ name: 'passkey_credentials' })
@Index('idx_passkey_credentials_user_id', ['userId'])
@Unique('uq_passkey_credentials_credential_id', ['credentialId'])
export class PasskeyCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.passkeys, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_passkey_credentials_user_id',
  })
  user: User;

  @Column({ name: 'credential_id', type: 'varchar', length: 1024 })
  credentialId: string;

  @Column({ name: 'public_key', type: 'bytea' })
  publicKey: Buffer;

  @Column({ name: 'sign_count', type: 'bigint', default: 0 })
  signCount: string;

  @Column({
    type: 'text',
    array: true,
    default: () => "'{}'::text[]",
  })
  transports: string[];

  @Column({ type: 'varchar', length: 36, nullable: true })
  aaguid: string | null;

  @Column({ name: 'device_type', type: 'varchar', length: 32, nullable: true })
  deviceType: string | null;

  @Column({ name: 'backed_up', type: 'boolean', default: false })
  backedUp: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

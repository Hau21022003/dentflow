import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PlatformRoleCode {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}

@Entity({ name: 'platform_role_assignments' })
@Index('uq_active_platform_role_assignment', ['userId', 'roleCode'], {
  unique: true,
  where: '"revoked_at" IS NULL',
})
@Index('idx_active_platform_role_assignments_by_user', ['userId'], {
  where: '"revoked_at" IS NULL',
})
export class PlatformRoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'role_code',
    type: 'enum',
    enum: PlatformRoleCode,
    enumName: 'platform_role_code_enum',
  })
  roleCode: PlatformRoleCode;

  @Column({ name: 'assigned_by_user_id', type: 'uuid', nullable: true })
  assignedByUserId: string | null;

  @Column({
    name: 'assigned_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  assignedAt: Date;

  @Column({
    name: 'assignment_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  assignmentReason: string | null;

  @Column({ name: 'revoked_by_user_id', type: 'uuid', nullable: true })
  revokedByUserId: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({
    name: 'revocation_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  revocationReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.platformRoleAssignments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_by_user_id', referencedColumnName: 'id' })
  assignedByUser: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'revoked_by_user_id', referencedColumnName: 'id' })
  revokedByUser: User | null;
}

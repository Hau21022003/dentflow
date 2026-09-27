import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { Visit } from './visit.entity';

@Entity({ name: 'treatment_notes' })
@Index('idx_treatment_notes_visit_created_at_id', [
  'visitId',
  'createdAt',
  'id',
])
export class TreatmentNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @Column({ name: 'visit_id', type: 'uuid' })
  visitId: string;

  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Visit, (visit) => visit.addenda, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'visit_id', referencedColumnName: 'id' })
  visit: Visit;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => Branch, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'branch_id', referencedColumnName: 'id' },
    { name: 'tenant_id', referencedColumnName: 'tenantId' },
  ])
  branch: Branch;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'author_user_id', referencedColumnName: 'id' })
  author: User;
}

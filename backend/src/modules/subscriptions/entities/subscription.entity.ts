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
import { SubscriptionPlan } from '../../subscription-plans/entities/subscription-plan.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Subscription records are retained as history. A future plan-change workflow
 * closes the old record and creates a new one instead of changing planId.
 */
@Entity({ name: 'subscriptions' })
@Index('idx_subscriptions_plan_id', ['planId'])
@Index('idx_subscriptions_tenant_id_status', ['tenantId', 'status'])
@Index(
  'uq_subscriptions_provider_subscription_id',
  ['providerSubscriptionId'],
  {
    unique: true,
    where: '"provider_subscription_id" IS NOT NULL',
  },
)
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'plan_id', type: 'uuid', update: false })
  planId: string;

  @Column({
    name: 'provider_customer_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerCustomerId: string | null;

  @Column({
    name: 'provider_subscription_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerSubscriptionId: string | null;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    enumName: 'subscription_status_enum',
  })
  status: SubscriptionStatus;

  @Column({ name: 'current_period_start', type: 'timestamptz', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id', referencedColumnName: 'id' })
  tenant: Tenant;

  @ManyToOne(() => SubscriptionPlan, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
  plan: SubscriptionPlan;
}

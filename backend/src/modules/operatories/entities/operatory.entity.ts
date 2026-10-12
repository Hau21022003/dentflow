import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OperatoryType {
  ROOM = 'ROOM',
  CHAIR = 'CHAIR',
}

@Entity({ name: 'operatories' })
@Index('idx_operatories_branch_active_name', [
  'tenantId',
  'branchId',
  'isActive',
  'name',
  'id',
])
@Check('chk_operatories_code_not_blank', `length(btrim("code")) > 0`)
@Check('chk_operatories_name_not_blank', `length(btrim("name")) > 0`)
export class Operatory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId: string;
  @Column({ type: 'varchar', length: 100 }) code: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({
    type: 'enum',
    enum: OperatoryType,
    enumName: 'operatory_type_enum',
  })
  type: OperatoryType;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformRoleAssignment } from './entities/platform-role-assignment.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { TenantUserMembershipStatus } from '../staff/entities/tenant-user-membership.entity';

@Injectable()
export class AuthorizationRepository {
  constructor(
    @InjectRepository(PlatformRoleAssignment)
    readonly platformRoleAssignments: Repository<PlatformRoleAssignment>,
    @InjectRepository(RoleAssignment)
    readonly roleAssignments: Repository<RoleAssignment>,
  ) {}

  findActivePlatformRoleAssignments(
    userId: string,
  ): Promise<PlatformRoleAssignment[]> {
    return this.platformRoleAssignments
      .createQueryBuilder('assignment')
      .where('assignment.user_id = :userId', { userId })
      .andWhere('assignment.revoked_at IS NULL')
      .getMany();
  }

  findActiveTenantRoleAssignments(userId: string): Promise<RoleAssignment[]> {
    return this.roleAssignments
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.tenant', 'tenant')
      .leftJoinAndSelect('assignment.branch', 'branch')
      .innerJoin(
        'tenant_user_memberships',
        'membership',
        'membership.user_id = assignment.user_id AND membership.tenant_id = assignment.tenant_id AND membership.status = :membershipStatus',
        { membershipStatus: TenantUserMembershipStatus.ACTIVE },
      )
      .where('assignment.user_id = :userId', { userId })
      .andWhere('assignment.revoked_at IS NULL')
      .getMany();
  }

  findActiveTenantRoleAssignmentsForScope(
    userId: string,
    tenantId: string,
    branchId?: string,
  ): Promise<RoleAssignment[]> {
    const query = this.roleAssignments
      .createQueryBuilder('assignment')
      .innerJoin(
        'tenant_user_memberships',
        'membership',
        'membership.user_id = assignment.user_id AND membership.tenant_id = assignment.tenant_id AND membership.status = :membershipStatus',
        { membershipStatus: TenantUserMembershipStatus.ACTIVE },
      )
      .where('assignment.user_id = :userId', { userId })
      .andWhere('assignment.tenant_id = :tenantId', { tenantId })
      .andWhere('assignment.revoked_at IS NULL');

    if (branchId) {
      query.andWhere(
        '(assignment.branch_id IS NULL OR assignment.branch_id = :branchId)',
        { branchId },
      );
    } else {
      query.andWhere('assignment.branch_id IS NULL');
    }

    return query.getMany();
  }
}

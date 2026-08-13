import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformRoleAssignment } from './entities/platform-role-assignment.entity';
import { RoleAssignment } from './entities/role-assignment.entity';

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
      .where('assignment.user_id = :userId', { userId })
      .andWhere('assignment.revoked_at IS NULL')
      .getMany();
  }
}

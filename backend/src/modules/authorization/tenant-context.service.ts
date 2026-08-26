import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import type { AuthorizationContext } from './authorization-context';
import type { AuthorizationScope } from './authorization.constants';

@Injectable()
export class TenantContextService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  async resolveTenantContext(
    actor: AuthorizationContext['actor'],
    scope: Extract<AuthorizationScope, 'tenant' | 'branch'>,
    tenantSlug: string | undefined,
    branchSlug?: string,
  ): Promise<AuthorizationContext> {
    if (!tenantSlug) {
      throw new NotFoundException('Tenant not found.');
    }

    const tenant = await this.tenantsRepository.findOneBy({
      slug: tenantSlug,
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const authorizationContext: AuthorizationContext = {
      actor,
      scope,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        status: tenant.status,
      },
    };

    if (scope === 'tenant') {
      return authorizationContext;
    }

    if (!branchSlug) {
      throw new NotFoundException('Branch not found.');
    }

    const branch = await this.branchesRepository.findOneBy({
      tenantId: tenant.id,
      slug: branchSlug,
    });
    if (!branch) {
      throw new NotFoundException('Branch not found.');
    }

    authorizationContext.branch = {
      id: branch.id,
      slug: branch.slug,
      status: branch.status,
    };

    return authorizationContext;
  }
}

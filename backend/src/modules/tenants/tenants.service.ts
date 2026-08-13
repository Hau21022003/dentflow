import { Injectable } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';

@Injectable()
export class TenantsService {
  constructor(private readonly tenantsRepository: TenantsRepository) {}
}

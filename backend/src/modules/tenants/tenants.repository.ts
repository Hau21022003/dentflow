import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsRepository {
  constructor(
    @InjectRepository(Tenant)
    readonly ormRepository: Repository<Tenant>,
  ) {}
}

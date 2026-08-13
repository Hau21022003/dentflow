import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';

@Injectable()
export class BranchesRepository {
  constructor(
    @InjectRepository(Branch)
    readonly ormRepository: Repository<Branch>,
  ) {}
}

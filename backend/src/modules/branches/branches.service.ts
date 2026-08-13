import { Injectable } from '@nestjs/common';
import { BranchesRepository } from './branches.repository';

@Injectable()
export class BranchesService {
  constructor(private readonly branchesRepository: BranchesRepository) {}
}

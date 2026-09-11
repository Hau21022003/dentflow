import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { ProposedRoleAssignmentsDto } from './proposed-role-assignment.dto';

export class GrantRoleAssignmentsDto extends ProposedRoleAssignmentsDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @NormalizeWhitespace()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

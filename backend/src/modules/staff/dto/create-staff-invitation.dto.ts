import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';
import { ProposedRoleAssignmentsDto } from './proposed-role-assignment.dto';

export class CreateStaffInvitationDto extends ProposedRoleAssignmentsDto {
  @ApiProperty({ example: 'staff@bright-smile.example.test' })
  @Trim()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Nhân sự Synthetic' })
  @NormalizeWhitespace()
  @IsString()
  @MaxLength(150)
  fullName: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @NormalizeWhitespace()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

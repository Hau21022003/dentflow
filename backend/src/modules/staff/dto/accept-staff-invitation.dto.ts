import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export class AcceptStaffInvitationDto {
  @ApiProperty({ description: 'Capability from the staff invitation link.' })
  @Trim()
  @IsString()
  @MaxLength(512)
  token: string;

  @ApiPropertyOptional({
    description: 'Required only when the invitation creates a new identity.',
  })
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(1024)
  password?: string;
}

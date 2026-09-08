import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export class AcceptTenantOwnerInvitationDto {
  @ApiProperty({
    description: 'Invitation capability from the invitation link.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @ApiPropertyOptional({
    description: 'Required only when accepting as a new identity.',
  })
  @NormalizeWhitespace()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Required only when accepting as a new identity.',
  })
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(1024)
  password?: string;
}

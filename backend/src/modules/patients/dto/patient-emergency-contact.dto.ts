import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export class PatientEmergencyContactDto {
  @ApiProperty({ maxLength: 150 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ maxLength: 30 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @NormalizeWhitespace()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  relationship?: string;
}

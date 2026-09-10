import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';

export class DeactivateBranchDto {
  @ApiProperty({ maxLength: 500 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

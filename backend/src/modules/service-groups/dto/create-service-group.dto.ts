import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeWhitespace } from '../../../common/dto-decorators/normalize-whitespace.decorator';

export class CreateServiceGroupDto {
  @ApiProperty({ maxLength: 100 })
  @NormalizeWhitespace()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

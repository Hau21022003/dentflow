import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export class LoginDto {
  @ApiProperty({ example: 'dentist@example.test' })
  @Trim()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'synthetic-demo-password' })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  password: string;
}

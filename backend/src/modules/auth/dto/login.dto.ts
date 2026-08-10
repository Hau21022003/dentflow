import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'dentist@example.test' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'synthetic-demo-password' })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  password: string;
}

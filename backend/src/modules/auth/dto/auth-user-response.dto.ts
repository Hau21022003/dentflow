import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'dentist@example.test' })
  email: string;

  @ApiProperty({ example: 'Bác sĩ Demo' })
  fullName: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

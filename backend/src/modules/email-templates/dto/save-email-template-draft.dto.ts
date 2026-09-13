import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export class SaveEmailTemplateDraftDto {
  @ApiProperty({ example: 'Activate your {{tenantDisplayName}} account' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject: string;

  @ApiProperty({
    example:
      'Activate your account: {{invitationUrl}}\n\nThis invitation expires at {{expiresAt}}.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  text: string;

  @ApiProperty({
    example:
      '<p><a href="{{invitationUrl}}">Activate your account</a></p><p>This invitation expires at {{expiresAt}}.</p>',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  html: string;
}

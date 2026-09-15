import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateMyProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'A temporary avatar object key returned by POST /uploads/image-intents, or null to remove the current avatar.',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(500)
  avatarObjectKey?: string | null;
}

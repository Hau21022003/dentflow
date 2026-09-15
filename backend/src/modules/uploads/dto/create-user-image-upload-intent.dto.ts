import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CreateImageUploadIntentDto } from './create-image-upload-intent.dto';

export enum UserImageUploadFolder {
  AVATAR = 'AVATAR',
}

/**
 * Folder is a server-controlled upload purpose, never a client-provided path.
 * New user-owned image purposes may extend this enum without adding routes.
 */
export class CreateUserImageUploadIntentDto extends CreateImageUploadIntentDto {
  @ApiProperty({ enum: UserImageUploadFolder })
  @IsEnum(UserImageUploadFolder)
  folder: UserImageUploadFolder;
}

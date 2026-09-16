import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Min } from 'class-validator';
import { IMAGE_CONTENT_TYPES } from '../upload.constants';

export class CreateImageUploadIntentDto {
  @ApiProperty({ enum: IMAGE_CONTENT_TYPES, example: 'image/jpeg' })
  @IsString()
  @IsIn(IMAGE_CONTENT_TYPES)
  contentType: string;

  @ApiProperty({ minimum: 1, example: 524_288 })
  @IsInt()
  @Min(1)
  sizeBytes: number;
}

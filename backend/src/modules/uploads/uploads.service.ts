import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';
import {
  OBJECT_STORAGE,
  ObjectStorageUnavailableError,
  type ObjectStorage,
} from '../../infrastructure/storage';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { CreateImageUploadIntentDto } from './dto/create-image-upload-intent.dto';
import {
  IMAGE_EXTENSION_BY_CONTENT_TYPE,
  type ImageContentType,
} from './upload.constants';

export interface ImageUploadIntentResponse {
  objectKey: string;
  expiresAt: string;
  upload: {
    url: string;
    fields: Record<string, string>;
  };
}

@Injectable()
export class UploadsService {
  constructor(
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
    private readonly config: AppConfigService,
  ) {}

  async createImageUploadIntent(
    context: AuthorizationContext,
    input: CreateImageUploadIntentDto,
  ): Promise<ImageUploadIntentResponse> {
    const maxFileSizeBytes = this.config.uploadConfig.maxFileSizeBytes;
    if (input.sizeBytes < 1) {
      throw new BadRequestException('Image file must not be empty.');
    }
    if (input.sizeBytes > maxFileSizeBytes) {
      throw new PayloadTooLargeException(
        `Image size must not exceed ${this.config.uploadConfig.maxFileSizeMb} MB.`,
      );
    }

    const tenantId = context.tenant?.id;
    const branchId = context.branch?.id;
    if (!tenantId || !branchId) {
      throw new ServiceUnavailableException(
        'A branch upload context is required.',
      );
    }

    const contentType = input.contentType as ImageContentType;
    const extension = IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType];
    if (!extension) {
      throw new BadRequestException('Unsupported image content type.');
    }
    const objectKey = `temp/${tenantId}/${branchId}/${randomUUID()}.${extension}`;

    try {
      const upload = await this.objectStorage.createPresignedPost({
        key: objectKey,
        contentType,
        maxBytes: maxFileSizeBytes,
      });
      const expiresAt = new Date(
        Date.now() + this.config.s3Config.presignedPostTtlMs,
      ).toISOString();

      return { objectKey, expiresAt, upload };
    } catch (error) {
      if (error instanceof ObjectStorageUnavailableError) {
        throw new ServiceUnavailableException(
          'Image uploads are not configured for this environment.',
        );
      }
      throw error;
    }
  }
}

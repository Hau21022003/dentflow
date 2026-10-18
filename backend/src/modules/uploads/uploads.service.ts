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
  CreateUserImageUploadIntentDto,
  UserImageUploadFolder,
} from './dto/create-user-image-upload-intent.dto';
import {
  BranchImageUploadPurpose,
  IMAGE_CONTENT_TYPES,
  IMAGE_EXTENSION_BY_CONTENT_TYPE,
  IMAGE_UPLOAD_POLICIES,
  type ImageContentType,
  type ImageUploadPolicy,
} from './upload.constants';

const BRANCH_IMAGE_UPLOAD_DIRECTORY_BY_PURPOSE: Readonly<
  Record<BranchImageUploadPurpose, string>
> = {
  [BranchImageUploadPurpose.TREATMENT_PROGRESS]: 'treatment-progress',
};

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
    const tenantId = context.tenant?.id;
    const branchId = context.branch?.id;
    if (!tenantId || !branchId) {
      throw new ServiceUnavailableException(
        'A branch upload context is required.',
      );
    }

    const policy = this.branchImageUploadPolicy(input.purpose);
    const extension = this.extensionFor(input, policy);
    const objectKey = this.branchObjectKey(
      tenantId,
      branchId,
      context.actor.userId,
      input.purpose,
      extension,
    );

    return this.createIntent(objectKey, input, policy);
  }

  async createUserImageUploadIntent(
    userId: string,
    input: CreateUserImageUploadIntentDto,
  ): Promise<ImageUploadIntentResponse> {
    const policy = this.defaultImageUploadPolicy();
    const extension = this.extensionFor(input, policy);
    const objectKey = this.userObjectKey(userId, input.folder, extension);

    return this.createIntent(objectKey, input, policy);
  }

  private branchImageUploadPolicy(
    purpose: BranchImageUploadPurpose | undefined,
  ): ImageUploadPolicy {
    return purpose
      ? IMAGE_UPLOAD_POLICIES[purpose]
      : this.defaultImageUploadPolicy();
  }

  private defaultImageUploadPolicy(): ImageUploadPolicy {
    return {
      maxFileSizeBytes: this.config.uploadConfig.maxFileSizeBytes,
      allowedContentTypes: IMAGE_CONTENT_TYPES,
    };
  }

  private branchObjectKey(
    tenantId: string,
    branchId: string,
    userId: string,
    purpose: BranchImageUploadPurpose | undefined,
    extension: string,
  ): string {
    if (!purpose) {
      return `temp/${tenantId}/${branchId}/${randomUUID()}.${extension}`;
    }

    const directory = BRANCH_IMAGE_UPLOAD_DIRECTORY_BY_PURPOSE[purpose];
    return `temp/${tenantId}/${branchId}/${directory}/${userId}/${randomUUID()}.${extension}`;
  }

  private userObjectKey(
    userId: string,
    folder: UserImageUploadFolder,
    extension: string,
  ): string {
    switch (folder) {
      case UserImageUploadFolder.AVATAR:
        return `temp/users/${userId}/avatar/${randomUUID()}.${extension}`;
    }
  }

  private extensionFor(
    input: CreateImageUploadIntentDto,
    policy: ImageUploadPolicy,
  ): string {
    this.assertImageSize(input, policy.maxFileSizeBytes);
    const contentType = input.contentType as ImageContentType;
    if (!policy.allowedContentTypes.includes(contentType)) {
      throw new BadRequestException('Unsupported image content type.');
    }
    const extension = IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType];
    if (!extension) {
      throw new BadRequestException('Unsupported image content type.');
    }
    return extension;
  }

  private assertImageSize(
    input: CreateImageUploadIntentDto,
    maxFileSizeBytes: number,
  ): void {
    if (input.sizeBytes < 1) {
      throw new BadRequestException('Image file must not be empty.');
    }
    if (input.sizeBytes > maxFileSizeBytes) {
      throw new PayloadTooLargeException(
        `Image size must not exceed ${maxFileSizeBytes / (1024 * 1024)} MB.`,
      );
    }
  }

  private async createIntent(
    objectKey: string,
    input: CreateImageUploadIntentDto,
    policy: ImageUploadPolicy,
  ): Promise<ImageUploadIntentResponse> {
    try {
      const upload = await this.objectStorage.createPresignedPost({
        key: objectKey,
        contentType: input.contentType,
        maxBytes: policy.maxFileSizeBytes,
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

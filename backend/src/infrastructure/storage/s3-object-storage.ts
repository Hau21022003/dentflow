import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type {
  CreatePresignedPostInput,
  ObjectStorage,
  PresignedPost,
} from './object-storage.types';

export class S3ObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly expiresInSeconds: number,
  ) {}

  createPresignedPost(input: CreatePresignedPostInput): Promise<PresignedPost> {
    return createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: input.key,
      Expires: this.expiresInSeconds,
      Fields: {
        'Content-Type': input.contentType,
      },
      Conditions: [
        { bucket: this.bucket },
        { key: input.key },
        { 'Content-Type': input.contentType },
        ['content-length-range', 1, input.maxBytes],
      ],
    });
  }
}

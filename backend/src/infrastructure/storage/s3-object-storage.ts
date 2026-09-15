import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type {
  CopyObjectInput,
  CreatePresignedPostInput,
  ObjectStorage,
  PresignedPost,
  StoredObjectMetadata,
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

  createPresignedGet(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.expiresInSeconds },
    );
  }

  async headObject(key: string): Promise<StoredObjectMetadata> {
    const object = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      contentType: object.ContentType,
      sizeBytes: object.ContentLength,
    };
  }

  async copyObject(input: CopyObjectInput): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: input.destinationKey,
        CopySource: `${this.bucket}/${input.sourceKey
          .split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/')}`,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

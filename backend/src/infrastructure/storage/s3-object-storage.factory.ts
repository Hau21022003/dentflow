import { S3Client } from '@aws-sdk/client-s3';
import { DisabledObjectStorage } from './disabled-object-storage';
import type { ObjectStorage } from './object-storage.types';
import { S3ObjectStorage } from './s3-object-storage';

export interface S3StorageConfig {
  enabled: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucket?: string;
  endpoint?: string;
  presignedPostTtlMs: number;
  usePathStyleEndpoint: boolean;
}

export function createObjectStorage(config: S3StorageConfig): ObjectStorage {
  if (!config.enabled) {
    return new DisabledObjectStorage();
  }

  if (!config.region || !config.bucket) {
    throw new Error('S3 region and bucket are required when S3 is enabled.');
  }

  const client = new S3Client({
    region: config.region,
    forcePathStyle: config.usePathStyleEndpoint,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
  });

  return new S3ObjectStorage(
    client,
    config.bucket,
    Math.max(1, Math.floor(config.presignedPostTtlMs / 1000)),
  );
}

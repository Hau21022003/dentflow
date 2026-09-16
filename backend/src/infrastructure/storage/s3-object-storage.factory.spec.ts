import { ObjectStorageUnavailableError } from './object-storage-unavailable.error';
import { createObjectStorage } from './s3-object-storage.factory';

describe('createObjectStorage', () => {
  it('returns an unavailable adapter without reading S3 credentials when disabled', async () => {
    const storage = createObjectStorage({
      enabled: false,
      presignedPostTtlMs: 5 * 60 * 1000,
      usePathStyleEndpoint: false,
    });

    await expect(
      storage.createPresignedPost({
        key: 'temp/tenant/branch/image.jpg',
        contentType: 'image/jpeg',
        maxBytes: 2 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(ObjectStorageUnavailableError);
  });
});

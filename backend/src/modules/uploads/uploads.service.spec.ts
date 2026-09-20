import {
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import {
  ObjectStorageUnavailableError,
  type CreatePresignedPostInput,
  type ObjectStorage,
  type PresignedPost,
} from '../../infrastructure/storage';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const createPresignedPost = jest.fn<
    Promise<PresignedPost>,
    [CreatePresignedPostInput]
  >();
  const storage: ObjectStorage = {
    createPresignedPost,
    createPresignedGet: jest.fn(),
    headObject: jest.fn(),
    copyObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const config = {
    uploadConfig: {
      maxFileSizeMb: 2,
      maxFileSizeBytes: 2 * 1024 * 1024,
    },
    s3Config: {
      presignedPostTtlMs: 5 * 60 * 1000,
    },
  } as AppConfigService;
  const service = new UploadsService(storage, config);

  beforeEach(() => {
    jest.resetAllMocks();
    createPresignedPost.mockResolvedValue({
      url: 'https://storage.example.test/dentflow-uploads',
      fields: { key: 'signed-key' },
    });
  });

  it('creates a server-owned tenant and branch scoped key', async () => {
    const response = await service.createImageUploadIntent(branchContext(), {
      contentType: 'image/jpeg',
      sizeBytes: 524_288,
    });

    const issuedPost = createPresignedPost.mock.calls[0]?.[0];
    expect(issuedPost?.key).toMatch(
      /^temp\/tenant-uuid\/branch-uuid\/[0-9a-f-]+\.jpg$/,
    );
    expect(issuedPost?.contentType).toBe('image/jpeg');
    expect(issuedPost?.maxBytes).toBe(2 * 1024 * 1024);
    expect(response.objectKey).toMatch(
      /^temp\/tenant-uuid\/branch-uuid\/[0-9a-f-]+\.jpg$/,
    );
    expect(Date.parse(response.expiresAt)).not.toBeNaN();
    expect(response.upload).toEqual({
      url: 'https://storage.example.test/dentflow-uploads',
      fields: { key: 'signed-key' },
    });
  });

  it('rejects a declared image larger than the configured limit', async () => {
    await expect(
      service.createImageUploadIntent(branchContext(), {
        contentType: 'image/png',
        sizeBytes: 2 * 1024 * 1024 + 1,
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(createPresignedPost).not.toHaveBeenCalled();
  });

  it('does not issue an intent when object storage is disabled', async () => {
    createPresignedPost.mockRejectedValue(new ObjectStorageUnavailableError());

    await expect(
      service.createImageUploadIntent(branchContext(), {
        contentType: 'image/webp',
        sizeBytes: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('creates a user-owned key only for the AVATAR upload folder', async () => {
    const response = await service.createUserImageUploadIntent('user-uuid', {
      folder: 'AVATAR' as never,
      contentType: 'image/webp',
      sizeBytes: 524_288,
    });

    expect(response.objectKey).toMatch(
      /^temp\/users\/user-uuid\/avatar\/[0-9a-f-]{36}\.webp$/i,
    );
    expect(createPresignedPost).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: response.objectKey,
        contentType: 'image/webp',
      }),
    );
  });
});

function branchContext(): AuthorizationContext {
  return {
    actor: {
      userId: 'user-uuid',
      sessionId: 'session-uuid',
    },
    scope: 'branch',
    tenant: {
      id: 'tenant-uuid',
      slug: 'synthetic-clinic',
      status: 'ACTIVE' as never,
    },
    branch: {
      id: 'branch-uuid',
      slug: 'central',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'ACTIVE' as never,
    },
  };
}

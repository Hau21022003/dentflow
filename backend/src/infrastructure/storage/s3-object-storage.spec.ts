jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn(),
}));

import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { S3ObjectStorage } from './s3-object-storage';

describe('S3ObjectStorage', () => {
  const createPost = jest.mocked(createPresignedPost);
  const client = new S3Client({ region: 'ap-southeast-1' });
  const storage = new S3ObjectStorage(client, 'dentflow-uploads', 300);

  beforeEach(() => {
    jest.resetAllMocks();
    createPost.mockResolvedValue({
      url: 'https://storage.example.test/dentflow-uploads',
      fields: { key: 'temp/signed-key' },
    });
  });

  it('signs the exact key, MIME type, and content-length range', async () => {
    await expect(
      storage.createPresignedPost({
        key: 'temp/tenant/branch/image.png',
        contentType: 'image/png',
        maxBytes: 2 * 1024 * 1024,
      }),
    ).resolves.toEqual({
      url: 'https://storage.example.test/dentflow-uploads',
      fields: { key: 'temp/signed-key' },
    });

    expect(createPost).toHaveBeenCalledWith(client, {
      Bucket: 'dentflow-uploads',
      Key: 'temp/tenant/branch/image.png',
      Expires: 300,
      Fields: { 'Content-Type': 'image/png' },
      Conditions: [
        { bucket: 'dentflow-uploads' },
        { key: 'temp/tenant/branch/image.png' },
        { 'Content-Type': 'image/png' },
        ['content-length-range', 1, 2 * 1024 * 1024],
      ],
    });
  });
});

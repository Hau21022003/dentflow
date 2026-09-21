import type { DataSource } from 'typeorm';
import type { AppConfigService } from '../../config/app-config.service';
import type { ObjectStorage } from '../../infrastructure/storage';
import type { AuditLogService } from '../audit';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const createPresignedGet = jest.fn<Promise<string>, [string]>();
  const storage: ObjectStorage = {
    createPresignedPost: jest.fn(),
    createPresignedGet,
    headObject: jest.fn(),
    copyObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const service = new UsersService(
    {} as DataSource,
    storage,
    {} as AppConfigService,
    {} as AuditLogService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('signs each unique user avatar once and retains null avatars', async () => {
    createPresignedGet.mockResolvedValue('https://storage.example.test/signed');

    const avatarUrls = await service.avatarUrlsFor([
      {
        id: 'dentist-1',
        avatarObjectKey: 'avatars/users/dentist-1/avatar.jpg',
      },
      {
        id: 'dentist-1',
        avatarObjectKey: 'avatars/users/dentist-1/avatar.jpg',
      },
      { id: 'dentist-2', avatarObjectKey: null },
    ]);

    expect(createPresignedGet).toHaveBeenCalledTimes(1);
    expect(createPresignedGet).toHaveBeenCalledWith(
      'avatars/users/dentist-1/avatar.jpg',
    );
    expect(avatarUrls).toEqual(
      new Map([
        ['dentist-1', 'https://storage.example.test/signed'],
        ['dentist-2', null],
      ]),
    );
  });
});

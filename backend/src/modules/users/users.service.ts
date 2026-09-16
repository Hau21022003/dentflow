import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../../config/app-config.service';
import {
  OBJECT_STORAGE,
  ObjectStorageUnavailableError,
  type ObjectStorage,
} from '../../infrastructure/storage';
import { AuditAction, AuditLogService, AuditActorType } from '../audit';
import type { AccessTokenPayload } from '../auth/auth.types';
import {
  IMAGE_EXTENSION_BY_CONTENT_TYPE,
  IMAGE_CONTENT_TYPES,
  type ImageContentType,
} from '../uploads/upload.constants';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { User, UserStatus } from './entities/user.entity';

export interface UserProfileResponse {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
    private readonly config: AppConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async updateMyProfile(
    actor: AccessTokenPayload,
    input: UpdateMyProfileDto,
  ): Promise<UserProfileResponse> {
    let copiedAvatarKey: string | null = null;
    let temporaryAvatarKey: string | null = null;

    if (typeof input.avatarObjectKey === 'string') {
      const extension = this.avatarTempExtension(
        actor.sub,
        input.avatarObjectKey,
      );
      await this.assertValidAvatarObject(input.avatarObjectKey, extension);
      temporaryAvatarKey = input.avatarObjectKey;
      copiedAvatarKey = `avatars/users/${actor.sub}/${randomUUID()}.${extension}`;
      await this.copyAvatar(temporaryAvatarKey, copiedAvatarKey);
    }

    let result: { user: User; previousAvatarKey: string | null };
    try {
      result = await this.dataSource.transaction(async (manager) => {
        const user = await manager
          .getRepository(User)
          .createQueryBuilder('user')
          .setLock('pessimistic_write')
          .where('user.id = :userId', { userId: actor.sub })
          .getOne();

        if (!user || user.status !== UserStatus.ACTIVE) {
          throw new UnauthorizedException();
        }

        const previousAvatarKey = user.avatarObjectKey;
        const changedFields: string[] = [];
        if (user.fullName !== input.fullName) {
          user.fullName = input.fullName;
          changedFields.push('fullName');
        }
        if (input.avatarObjectKey !== undefined) {
          const nextAvatarKey =
            input.avatarObjectKey === null ? null : copiedAvatarKey;
          if (previousAvatarKey !== nextAvatarKey) {
            user.avatarObjectKey = nextAvatarKey;
            changedFields.push('avatar');
          }
        }

        if (changedFields.length > 0) {
          await manager.getRepository(User).save(user);
          await this.auditLogService.record(manager, {
            action: AuditAction.USER_PROFILE_UPDATED,
            actor: {
              type: AuditActorType.USER,
              userId: actor.sub,
              sessionId: actor.sid,
            },
            resourceId: user.id,
            after: { changedFields },
          });
        }

        return { user, previousAvatarKey };
      });
    } catch (error) {
      if (copiedAvatarKey) {
        await this.deleteObjectQuietly(copiedAvatarKey);
      }
      throw error;
    }

    if (temporaryAvatarKey) {
      await this.deleteObjectQuietly(temporaryAvatarKey);
    }
    if (
      result.previousAvatarKey &&
      result.previousAvatarKey !== result.user.avatarObjectKey
    ) {
      await this.deleteObjectQuietly(result.previousAvatarKey);
    }

    return this.toProfile(result.user);
  }

  async toProfile(user: User): Promise<UserProfileResponse> {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: await this.avatarUrlFor(user.avatarObjectKey),
    };
  }

  private avatarTempExtension(userId: string, objectKey: string): string {
    const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(
      `^temp/users/${escapedUserId}/avatar/[0-9a-f-]{36}\\.(jpg|png|webp)$`,
      'i',
    ).exec(objectKey);
    if (!match) {
      throw new BadRequestException('Avatar upload key is invalid.');
    }
    return match[1].toLowerCase();
  }

  private async assertValidAvatarObject(
    objectKey: string,
    extension: string,
  ): Promise<void> {
    try {
      const object = await this.objectStorage.headObject(objectKey);
      const contentType = object.contentType as ImageContentType | undefined;
      const expectedExtension = contentType
        ? IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType]
        : undefined;
      if (
        !contentType ||
        !IMAGE_CONTENT_TYPES.includes(contentType) ||
        expectedExtension !== extension ||
        !object.sizeBytes ||
        object.sizeBytes < 1 ||
        object.sizeBytes > this.config.uploadConfig.maxFileSizeBytes
      ) {
        throw new BadRequestException('Avatar upload is invalid.');
      }
    } catch (error) {
      if (error instanceof ObjectStorageUnavailableError) {
        throw new ServiceUnavailableException(
          'Image uploads are not configured for this environment.',
        );
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Avatar upload was not found.');
    }
  }

  private async copyAvatar(
    sourceKey: string,
    destinationKey: string,
  ): Promise<void> {
    try {
      await this.objectStorage.copyObject({ sourceKey, destinationKey });
    } catch (error) {
      if (error instanceof ObjectStorageUnavailableError) {
        throw new ServiceUnavailableException(
          'Image uploads are not configured for this environment.',
        );
      }
      throw error;
    }
  }

  private async avatarUrlFor(objectKey: string | null): Promise<string | null> {
    if (!objectKey) {
      return null;
    }
    try {
      return await this.objectStorage.createPresignedGet(objectKey);
    } catch (error) {
      if (error instanceof ObjectStorageUnavailableError) {
        return null;
      }
      throw error;
    }
  }

  private async deleteObjectQuietly(objectKey: string): Promise<void> {
    try {
      await this.objectStorage.deleteObject(objectKey);
    } catch {
      // A failed cleanup must not undo the profile update. Temp objects expire
      // automatically; permanent cleanup can be retried operationally.
    }
  }
}

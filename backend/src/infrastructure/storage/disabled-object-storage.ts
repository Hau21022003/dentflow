import { ObjectStorageUnavailableError } from './object-storage-unavailable.error';
import type {
  CopyObjectInput,
  CreatePresignedGetOptions,
  CreatePresignedPostInput,
  ObjectStorage,
  PresignedPost,
  StoredObjectMetadata,
} from './object-storage.types';

export class DisabledObjectStorage implements ObjectStorage {
  createPresignedPost(input: CreatePresignedPostInput): Promise<PresignedPost> {
    void input;
    return Promise.reject(new ObjectStorageUnavailableError());
  }

  createPresignedGet(
    key: string,
    options?: CreatePresignedGetOptions,
  ): Promise<string> {
    void key;
    void options;
    return Promise.reject(new ObjectStorageUnavailableError());
  }

  headObject(key: string): Promise<StoredObjectMetadata> {
    void key;
    return Promise.reject(new ObjectStorageUnavailableError());
  }

  copyObject(input: CopyObjectInput): Promise<void> {
    void input;
    return Promise.reject(new ObjectStorageUnavailableError());
  }

  deleteObject(key: string): Promise<void> {
    void key;
    return Promise.reject(new ObjectStorageUnavailableError());
  }
}

import { ObjectStorageUnavailableError } from './object-storage-unavailable.error';
import type {
  CreatePresignedPostInput,
  ObjectStorage,
  PresignedPost,
} from './object-storage.types';

export class DisabledObjectStorage implements ObjectStorage {
  createPresignedPost(input: CreatePresignedPostInput): Promise<PresignedPost> {
    void input;
    return Promise.reject(new ObjectStorageUnavailableError());
  }
}

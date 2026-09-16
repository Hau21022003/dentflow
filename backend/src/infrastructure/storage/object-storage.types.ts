export interface CreatePresignedPostInput {
  key: string;
  contentType: string;
  maxBytes: number;
}

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

export interface StoredObjectMetadata {
  contentType?: string;
  sizeBytes?: number;
}

export interface CopyObjectInput {
  sourceKey: string;
  destinationKey: string;
}

/**
 * Port for issuing tightly constrained direct-to-object-storage uploads.
 * Domain modules must not depend on a provider SDK or provider credentials.
 */
export interface ObjectStorage {
  createPresignedPost(input: CreatePresignedPostInput): Promise<PresignedPost>;
  createPresignedGet(key: string): Promise<string>;
  headObject(key: string): Promise<StoredObjectMetadata>;
  copyObject(input: CopyObjectInput): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

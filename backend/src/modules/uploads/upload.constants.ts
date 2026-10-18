export const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

export interface ImageUploadPolicy {
  readonly maxFileSizeBytes: number;
  readonly allowedContentTypes: readonly ImageContentType[];
}

export enum BranchImageUploadPurpose {
  TREATMENT_PROGRESS = 'TREATMENT_PROGRESS',
}

export const IMAGE_UPLOAD_POLICIES: Readonly<
  Record<BranchImageUploadPurpose, ImageUploadPolicy>
> = {
  [BranchImageUploadPurpose.TREATMENT_PROGRESS]: {
    maxFileSizeBytes: 5 * 1024 * 1024,
    allowedContentTypes: IMAGE_CONTENT_TYPES,
  },
};

export const IMAGE_EXTENSION_BY_CONTENT_TYPE: Readonly<
  Record<ImageContentType, string>
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

import http from "./http";
import { SHARED_ENDPOINTS } from "../constants/endpoint.constants";

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface ImageUploadIntentResponse {
  objectKey: string;
  expiresAt: string;
  upload: {
    url: string;
    fields: Record<string, string>;
  };
}

export interface UploadTempImageInput {
  tenantSlug: string;
  branchSlug: string;
  file: File;
  signal?: AbortSignal;
}

export interface UploadedTempImage {
  objectKey: string;
  expiresAt: string;
}

export type UserImageUploadFolder = "AVATAR";

export interface UploadUserTempImageInput {
  file: File;
  folder: UserImageUploadFolder;
  signal?: AbortSignal;
}

/**
 * Uploads an image directly to the private object-storage bucket. The API
 * creates the tenant/branch-scoped key and returns a short-lived POST policy.
 */
export async function uploadTempImage(
  input: UploadTempImageInput,
): Promise<UploadedTempImage> {
  validateImage(input.file);

  const tenantSlug = encodeURIComponent(input.tenantSlug);
  const branchSlug = encodeURIComponent(input.branchSlug);
  const intentResponse = await http.post<ImageUploadIntentResponse>(
    `/tenants/${tenantSlug}/branches/${branchSlug}/uploads/image-intents`,
    {
      contentType: input.file.type,
      sizeBytes: input.file.size,
    },
    { signal: input.signal },
  );
  const intent = intentResponse.payload;
  const formData = new FormData();

  Object.entries(intent.upload.fields).forEach(([name, value]) => {
    formData.append(name, value);
  });
  // S3-compatible POST APIs require the file field to be appended last.
  formData.append("file", input.file);

  const uploadResponse = await fetch(intent.upload.url, {
    method: "POST",
    body: formData,
    signal: input.signal,
  });
  if (!uploadResponse.ok) {
    throw new Error(
      `Image upload failed with status ${uploadResponse.status}.`,
    );
  }

  return {
    objectKey: intent.objectKey,
    expiresAt: intent.expiresAt,
  };
}

/** Uploads a user-owned image through the common authenticated intent route. */
export async function uploadUserTempImage(
  input: UploadUserTempImageInput,
): Promise<UploadedTempImage> {
  validateImage(input.file);

  const intentResponse = await http.post<ImageUploadIntentResponse>(
    SHARED_ENDPOINTS.UPLOADS.IMAGE_INTENTS,
    {
      folder: input.folder,
      contentType: input.file.type,
      sizeBytes: input.file.size,
    },
    { signal: input.signal },
  );
  const intent = intentResponse.payload;
  const formData = new FormData();

  Object.entries(intent.upload.fields).forEach(([name, value]) => {
    formData.append(name, value);
  });
  formData.append("file", input.file);

  const uploadResponse = await fetch(intent.upload.url, {
    method: "POST",
    body: formData,
    signal: input.signal,
  });
  if (!uploadResponse.ok) {
    throw new Error(
      `Image upload failed with status ${uploadResponse.status}.`,
    );
  }

  return {
    objectKey: intent.objectKey,
    expiresAt: intent.expiresAt,
  };
}

function validateImage(file: File): void {
  if (!IMAGE_CONTENT_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, and WEBP images are supported.");
  }
  if (file.size < 1) {
    throw new Error("Image file must not be empty.");
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image size must not exceed 2 MB.");
  }
}

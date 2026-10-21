import http from "@/shared/lib/http";

export const PATIENT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const PATIENT_FILE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

interface FileUploadIntentResponse {
  objectKey: string;
  expiresAt: string;
  upload: { url: string; fields: Record<string, string> };
}

export async function uploadTemporaryPatientFile(input: {
  tenantSlug: string;
  branchSlug: string;
  file: File;
  signal?: AbortSignal;
}): Promise<{ objectKey: string; expiresAt: string }> {
  if (
    !PATIENT_FILE_CONTENT_TYPES.includes(
      input.file.type as (typeof PATIENT_FILE_CONTENT_TYPES)[number],
    )
  ) {
    throw new Error("Unsupported patient file type.");
  }
  if (input.file.size < 1 || input.file.size > PATIENT_FILE_MAX_BYTES) {
    throw new Error("Patient file size must be between 1 byte and 10 MB.");
  }
  const { payload } = await http.post<FileUploadIntentResponse>(
    `/tenants/${encodeURIComponent(input.tenantSlug)}/branches/${encodeURIComponent(input.branchSlug)}/uploads/file-intents`,
    {
      purpose: "PATIENT_FILE",
      contentType: input.file.type,
      sizeBytes: input.file.size,
    },
    { signal: input.signal },
  );
  const form = new FormData();
  Object.entries(payload.upload.fields).forEach(([key, value]) =>
    form.append(key, value),
  );
  form.append("file", input.file);
  const response = await fetch(payload.upload.url, {
    method: "POST",
    body: form,
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error(
      `Patient file upload failed with status ${response.status}.`,
    );
  }
  return { objectKey: payload.objectKey, expiresAt: payload.expiresAt };
}

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

type ApiMessage = string | string[];
type FieldErrorsPayload = Record<string, string[]>;

type ApiErrorPayload = {
  message?: ApiMessage;
  errors?: FieldErrorsPayload;
  [key: string]: unknown;
};

const DEFAULT_ERROR_MESSAGE = "Đã xảy ra lỗi. Vui lòng thử lại.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFieldErrors(value: unknown): value is FieldErrorsPayload {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    )
  );
}

function normalizePayload(payload: unknown): ApiErrorPayload {
  if (!isRecord(payload)) return {};

  const message = payload.message;
  const errors = payload.errors;

  return {
    ...(typeof message === "string" ||
    (Array.isArray(message) &&
      message.every((item) => typeof item === "string"))
      ? { message }
      : {}),
    ...(isFieldErrors(errors) ? { errors } : {}),
  };
}

function getMessage(message: ApiMessage | undefined): string {
  if (Array.isArray(message)) {
    return message[0] || DEFAULT_ERROR_MESSAGE;
  }

  return message || DEFAULT_ERROR_MESSAGE;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly payload: ApiErrorPayload;
  readonly fieldErrors: Record<string, string>;

  constructor({ status, payload }: { status?: number; payload?: unknown }) {
    const normalizedPayload = normalizePayload(payload);

    super(getMessage(normalizedPayload.message));

    this.name = "ApiError";
    this.status = status;
    this.payload = normalizedPayload;
    this.fieldErrors = Object.fromEntries(
      Object.entries(normalizedPayload.errors ?? {})
        .filter(([, messages]) => messages.length > 0)
        .map(([field, messages]) => [field, messages[0]]),
    );

    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;

    if (error instanceof Error) {
      return new ApiError({
        payload: { message: error.message },
      });
    }

    return new ApiError({
      payload: { message: DEFAULT_ERROR_MESSAGE },
    });
  }
}

export function getErrorMessage(error: unknown): string {
  return ApiError.from(error).message;
}

/**
 * Chuẩn hóa lỗi API và đưa thông báo lỗi vào biểu mẫu hoặc callback hiển thị.
 * Các lỗi theo từng trường sẽ được gán vào trường tương ứng; các lỗi còn lại
 * được gán vào lỗi cấp biểu mẫu hoặc gửi qua `onMessage`.
 */
export function handleApiError<T extends FieldValues>({
  error,
  setError,
  onMessage,
}: {
  error: unknown;
  setError?: UseFormSetError<T>;
  onMessage?: (message: string) => void;
}): ApiError {
  const apiError = ApiError.from(error);
  const entries = Object.entries(apiError.fieldErrors);

  if (setError && entries.length > 0) {
    entries.forEach(([field, message], index) => {
      setError(
        field as Path<T>,
        {
          type: "server",
          message,
        },
        {
          shouldFocus: index === 0,
        },
      );
    });

    return apiError;
  }

  if (setError) {
    setError("root.server", {
      type: "server",
      message: apiError.message,
    });
  } else {
    onMessage?.(apiError.message);
  }

  return apiError;
}

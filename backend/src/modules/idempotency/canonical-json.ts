export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        'Idempotency fingerprints cannot contain non-finite numbers.',
      );
    }

    return value;
  }

  if (value instanceof Date) {
    return value.toJSON();
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      entry === undefined ? null : canonicalize(entry),
    );
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  throw new TypeError('Idempotency fingerprints must be JSON serializable.');
}

/**
 * Serialize JSON theo thứ tự xác định bằng cách sắp xếp key của object và chuẩn
 * hóa phần tử array `undefined`. Hai command intent giống nhau luôn cho cùng input HMAC.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Tạo bản sao JSON tách biệt trước khi lưu HTTP outcome. Việc thay đổi kết quả
 * controller ở bước sau không được làm đổi body dùng cho replay.
 */
export function cloneJson(value: unknown): JsonValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('Idempotency outcomes must be JSON serializable.');
  }

  return JSON.parse(serialized) as JsonValue;
}

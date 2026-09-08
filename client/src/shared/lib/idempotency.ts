export type IdempotencyIntent = {
  key: string;
  signature: string;
};

export type IdempotentCommand = {
  idempotencyKey: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
}

/**
 * Retains a UUID for retries of an unchanged command and replaces it when the
 * user changes the command payload.
 */
export function idempotencyKeyForIntent(
  current: IdempotencyIntent | null,
  command: unknown,
): IdempotencyIntent {
  const signature = JSON.stringify(canonicalize(command));

  if (current?.signature === signature) {
    return current;
  }

  return { key: crypto.randomUUID(), signature };
}

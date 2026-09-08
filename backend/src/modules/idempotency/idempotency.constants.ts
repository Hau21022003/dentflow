export const IDEMPOTENT_OPERATION_KEY = 'idempotency:operation';
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotency-Replayed';
export const IDEMPOTENCY_RETRY_AFTER_HEADER = 'Retry-After';

export const IDEMPOTENCY_ERROR_CODES = {
  KEY_REQUIRED: 'idempotency_key_required',
  KEY_INVALID: 'idempotency_key_invalid',
  KEY_REUSED_WITH_DIFFERENT_REQUEST:
    'idempotency_key_reused_with_different_request',
  REQUEST_IN_PROGRESS: 'idempotency_request_in_progress',
} as const;

export const REPLAYABLE_RESPONSE_HEADERS = new Set([
  'cache-control',
  'etag',
  'location',
]);

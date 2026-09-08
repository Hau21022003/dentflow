import { applyDecorators, HttpStatus, SetMetadata } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';
import {
  IDEMPOTENCY_ERROR_CODES,
  IDEMPOTENT_OPERATION_KEY,
} from './idempotency.constants';

function IdempotencySwaggerContract(): MethodDecorator {
  return applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      description:
        'UUID v4 cho một command intent; giữ nguyên khi retry cùng request.',
      example: '7f4b2a10-8e35-4cb8-9a76-1d3f5e7c9b20',
      schema: {
        type: 'string',
        format: 'uuid',
        pattern:
          '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      },
    }),
    ApiResponse({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Thiếu hoặc sai định dạng Idempotency-Key.',
      examples: {
        keyRequired: {
          summary: 'Thiếu Idempotency-Key',
          value: {
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            code: IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
            message: 'Idempotency-Key header is required.',
          },
        },
        keyInvalid: {
          summary: 'Idempotency-Key không phải UUID v4',
          value: {
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            code: IDEMPOTENCY_ERROR_CODES.KEY_INVALID,
            message: 'Idempotency-Key header must be a UUID v4.',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description:
        'Key đã dùng cho request khác, hoặc request cùng key đang PROCESSING. Replay thành công trả response thành công gốc với Idempotency-Replayed: true.',
      headers: {
        'Retry-After': {
          description:
            'Số giây chờ trước khi retry; chỉ xuất hiện khi code là idempotency_request_in_progress.',
          schema: { type: 'integer', minimum: 1 },
        },
      },
      examples: {
        keyReusedWithDifferentRequest: {
          summary: 'Key đã dùng cho request khác',
          value: {
            statusCode: HttpStatus.CONFLICT,
            code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST,
            message:
              'Idempotency-Key was already used for a different request.',
          },
        },
        requestInProgress: {
          summary: 'Request cùng key vẫn đang xử lý',
          value: {
            statusCode: HttpStatus.CONFLICT,
            code: IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS,
            message: 'A request with this Idempotency-Key is still processing.',
          },
        },
      },
    }),
  );
}

/**
 * Đánh dấu HTTP command route bắt buộc có header `Idempotency-Key` UUID v4.
 *
 * Decorator này là nguồn khai báo duy nhất cho cả metadata runtime của
 * `IdempotencyInterceptor` lẫn Swagger contract chung. Khi thêm command mới,
 * không khai báo lại `ApiHeader` hoặc các lỗi idempotency trong controller.
 * `operation` là tên intent do server quản lý và được đưa vào fingerprint.
 */
export function Idempotent(operation: string): MethodDecorator {
  return applyDecorators(
    SetMetadata(IDEMPOTENT_OPERATION_KEY, operation),
    IdempotencySwaggerContract(),
  );
}

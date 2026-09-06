import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import {
  catchError,
  from,
  map,
  mergeMap,
  Observable,
  of,
  throwError,
} from 'rxjs';
import { RequestContextService } from '../../common/request-context/request-context.service';
import type { AuthenticatedRequest } from '../authorization/authorization-context';
import { cloneJson } from './canonical-json';
import {
  IDEMPOTENCY_ERROR_CODES,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  IDEMPOTENCY_RETRY_AFTER_HEADER,
  IDEMPOTENT_OPERATION_KEY,
  REPLAYABLE_RESPONSE_HEADERS,
} from './idempotency.constants';
import {
  type IdempotencyRecord,
  type ReplayableResponseHeaders,
} from './entities/idempotency-record.entity';
import {
  IdempotencyService,
  type ProcessingClaim,
} from './idempotency.service';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Chỉ chạy cho command có @Idempotent, sau khi guard đã thiết lập actor và
   * scope đã xác thực. Interceptor claim trước handler, snapshot outcome đã
   * serialize khi thành công, và giải phóng lease khi handler lỗi.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const operation = this.reflector.getAllAndOverride<string>(
      IDEMPOTENT_OPERATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!operation) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const authorizationContext = request.authorizationContext;

    if (!authorizationContext) {
      return throwError(
        () => new ConflictException('Authorization context is required.'),
      );
    }

    const key = this.resolveKey(request);
    const fingerprint = this.idempotency.fingerprint({
      operation,
      method: request.method,
      params: request.params,
      query: request.query,
      body: request.body,
      authorizationContext,
    });

    return from(
      this.idempotency.claim({
        actorUserId: authorizationContext.actor.userId,
        idempotencyKeyHash: this.idempotency.hashKey(key),
        requestFingerprintHash: fingerprint,
        originalRequestId: this.requestContext.get()?.requestId ?? randomUUID(),
      }),
    ).pipe(
      mergeMap((claimResult) => {
        if (claimResult.kind === 'mismatch') {
          return throwError(
            () =>
              new ConflictException({
                code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST,
                message:
                  'Idempotency-Key was already used for a different request.',
              }),
          );
        }

        if (claimResult.kind === 'in_progress') {
          response.setHeader(
            IDEMPOTENCY_RETRY_AFTER_HEADER,
            String(claimResult.retryAfterSeconds),
          );
          return throwError(
            () =>
              new ConflictException({
                code: IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS,
                message:
                  'A request with this Idempotency-Key is still processing.',
              }),
          );
        }

        if (claimResult.kind === 'replay') {
          return of(this.restoreOutcome(response, claimResult.record));
        }

        const claim: ProcessingClaim = {
          recordId: claimResult.recordId,
          processingToken: claimResult.processingToken,
        };

        return next.handle().pipe(
          catchError((error: unknown) =>
            from(this.idempotency.release(claim)).pipe(
              catchError(() => of(undefined)),
              mergeMap(() => throwError(() => error)),
            ),
          ),
          mergeMap((result: unknown) => {
            const responseHasBody = result !== undefined;
            const responseBody = responseHasBody ? cloneJson(result) : null;

            return from(
              this.idempotency.complete({
                claim,
                httpStatus: response.statusCode,
                responseHasBody,
                responseBody,
                responseHeaders: this.snapshotHeaders(response),
              }),
            ).pipe(
              // Command đã thành công. Nếu không lưu được replay snapshot, để
              // PROCESSING lease tự hết hạn thay vì biến mutation đã commit
              // thành HTTP outcome thất bại.
              catchError(() => of(false)),
              map(() => result),
            );
          }),
        );
      }),
    );
  }

  /** Kiểm tra public contract trước bất kỳ persistence lookup nào. */
  private resolveKey(request: Request): string {
    const header = request.headers[IDEMPOTENCY_KEY_HEADER];
    const key = Array.isArray(header) ? undefined : header;

    if (!key) {
      throw new UnprocessableEntityException({
        code: IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
        message: 'Idempotency-Key header is required.',
      });
    }

    if (!UUID_V4_PATTERN.test(key)) {
      throw new UnprocessableEntityException({
        code: IDEMPOTENCY_ERROR_CODES.KEY_INVALID,
        message: 'Idempotency-Key header must be a UUID v4.',
      });
    }

    return key;
  }

  /**
   * Chỉ giữ các header được cho phép replay. Request ID, cookie và hop-by-hop
   * header được chủ đích loại khỏi outcome đã lưu.
   */
  private snapshotHeaders(response: Response): ReplayableResponseHeaders {
    return Object.fromEntries(
      Object.entries(response.getHeaders())
        .filter(
          ([name, value]) =>
            REPLAYABLE_RESPONSE_HEADERS.has(name.toLowerCase()) &&
            (typeof value === 'string' ||
              (Array.isArray(value) &&
                value.every((entry) => typeof entry === 'string'))),
        )
        .map(([name, value]) => [name, value as string | string[]]),
    );
  }

  /** Khôi phục HTTP outcome đã lưu mà không replay dữ liệu riêng của request. */
  private restoreOutcome(
    response: Response,
    record: IdempotencyRecord,
  ): unknown {
    for (const [name, value] of Object.entries(record.responseHeaders ?? {})) {
      response.setHeader(name, value);
    }
    response.status(record.httpStatus!);
    response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');

    return record.responseHasBody ? record.responseBody : undefined;
  }
}

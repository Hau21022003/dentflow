import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { AppConfigService } from 'src/config/app-config.service';
import { AppLogger } from '../logging/app-logger.service';
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLogger,
    private readonly configService: AppConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startedAt = Date.now();
    const path = request.path ?? request.url?.split('?')[0] ?? 'unknown';

    if (this.configService.runtimeConfig.isDevelopment) {
      this.logger.debug(
        'http_request_started',
        {
          method: request.method,
          path,
          body: request.body,
          requestId: response.getHeader('X-Request-Id'),
        },
        LoggingInterceptor.name,
      );
    }

    return next.handle().pipe(
      tap(() => {
        this.logger.info(
          'http_request_completed',
          {
            method: request.method,
            path,
            requestId: response.getHeader('X-Request-Id'),
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          },
          LoggingInterceptor.name,
        );
      }),
      catchError((exception: unknown) => {
        const statusCode =
          exception instanceof HttpException ? exception.getStatus() : 500;

        const fields = {
          method: request.method,
          path,
          requestId: response.getHeader('X-Request-Id'),
          statusCode,
          durationMs: Date.now() - startedAt,
        };

        if (statusCode >= 500) {
          this.logger.error(
            'http_request_failed',
            exception,
            fields,
            LoggingInterceptor.name,
          );
        } else {
          this.logger.warn(
            'http_request_rejected',
            fields,
            LoggingInterceptor.name,
          );
        }

        return throwError(() => exception);
      }),
    );
  }
}

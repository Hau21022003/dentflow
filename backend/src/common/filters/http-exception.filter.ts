import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ClientErrorMessage = string | string[];

interface ErrorResponseBody {
  statusCode: number;
  message: ClientErrorMessage;
  error?: string;
  code?: string;
  errors?: Record<string, string[]>;
  path: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const path = request.path ?? request.url.split('?')[0];

    // Không cố gửi response lần hai, nhưng vẫn log lỗi phía trên.
    if (response.headersSent) {
      return;
    }

    response
      .status(statusCode)
      .json(this.toResponseBody(exception, statusCode, path));
  }

  private toResponseBody(
    exception: unknown,
    statusCode: number,
    path: string,
  ): ErrorResponseBody {
    const timestamp = new Date().toISOString();

    // Không lộ chi tiết nội bộ của bất kỳ lỗi 5xx nào.
    const internalServerErrorStatus = Number(HttpStatus.INTERNAL_SERVER_ERROR);
    if (statusCode >= internalServerErrorStatus) {
      return {
        statusCode,
        message: 'Internal server error',
        path,
        timestamp,
      };
    }

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    if (typeof exceptionResponse === 'string') {
      return {
        statusCode,
        message: exceptionResponse,
        path,
        timestamp,
      };
    }

    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      !Array.isArray(exceptionResponse)
    ) {
      const body = exceptionResponse as {
        message?: ClientErrorMessage;
        error?: string;
        code?: string;
        errors?: Record<string, string[]>;
      };

      return {
        statusCode,
        message: body.message ?? 'Request failed',
        ...(body.error ? { error: body.error } : {}),
        ...(body.code ? { code: body.code } : {}),
        ...(body.errors ? { errors: body.errors } : {}),
        path,
        timestamp,
      };
    }

    return {
      statusCode,
      message: 'Request failed',
      path,
      timestamp,
    };
  }
}

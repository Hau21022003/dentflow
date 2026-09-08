import { Injectable, type NestMiddleware } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { RequestContextService } from './request-context.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_USER_AGENT_LENGTH = 512;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly appConfig: AppConfigService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = this.resolveRequestId(request);
    response.setHeader('X-Request-Id', requestId);

    this.requestContext.run(
      {
        requestId,
        sourceIpHmac: this.hashSourceIp(request.socket.remoteAddress),
        userAgent: this.normalizeUserAgent(request.headers['user-agent']),
      },
      next,
    );
  }

  private resolveRequestId(request: Request): string {
    const incoming = request.headers['x-request-id'];
    const value = Array.isArray(incoming) ? incoming[0] : incoming;

    return value && UUID_PATTERN.test(value) ? value : randomUUID();
  }

  private hashSourceIp(sourceIp: string | undefined): string | null {
    if (!sourceIp) {
      return null;
    }

    return createHmac('sha256', this.appConfig.auditConfig.ipHmacSecret)
      .update(sourceIp)
      .digest('hex');
  }

  private normalizeUserAgent(
    value: string | string[] | undefined,
  ): string | null {
    const userAgent = Array.isArray(value) ? value[0] : value;
    if (!userAgent) {
      return null;
    }

    return userAgent.slice(0, MAX_USER_AGENT_LENGTH);
  }
}

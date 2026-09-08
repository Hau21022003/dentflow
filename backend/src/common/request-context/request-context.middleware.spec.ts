import { createHmac } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

describe('RequestContextMiddleware', () => {
  const secret = 'synthetic-audit-hmac-secret';

  it('keeps a valid request ID and stores only the HMAC of the source IP', () => {
    const requestContext = new RequestContextService();
    const middleware = new RequestContextMiddleware(requestContext, {
      auditConfig: { ipHmacSecret: secret },
    } as AppConfigService);
    const setHeader = jest.fn();
    let captured = undefined as ReturnType<RequestContextService['get']>;

    middleware.use(
      {
        headers: {
          'x-request-id': '00000000-0000-4000-8000-000000000789',
          'user-agent': 'Synthetic Agent',
        },
        socket: { remoteAddress: '203.0.113.7' },
      } as unknown as Request,
      { setHeader } as unknown as Response,
      (() => {
        captured = requestContext.get();
      }) as NextFunction,
    );

    expect(captured).toEqual({
      requestId: '00000000-0000-4000-8000-000000000789',
      sourceIpHmac: createHmac('sha256', secret)
        .update('203.0.113.7')
        .digest('hex'),
      userAgent: 'Synthetic Agent',
    });
    expect(setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      '00000000-0000-4000-8000-000000000789',
    );
  });

  it('replaces an invalid request ID and truncates user agent data', () => {
    const requestContext = new RequestContextService();
    const middleware = new RequestContextMiddleware(requestContext, {
      auditConfig: { ipHmacSecret: secret },
    } as AppConfigService);
    let captured = undefined as ReturnType<RequestContextService['get']>;

    middleware.use(
      {
        headers: {
          'x-request-id': 'not-a-uuid',
          'user-agent': 'a'.repeat(600),
        },
        socket: {},
      } as unknown as Request,
      { setHeader: jest.fn() } as unknown as Response,
      (() => {
        captured = requestContext.get();
      }) as NextFunction,
    );

    expect(captured?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(captured?.sourceIpHmac).toBeNull();
    expect(captured?.userAgent).toHaveLength(512);
  });
});

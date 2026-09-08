import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestAuditContext } from './request-context.types';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestAuditContext>();

  run<T>(context: RequestAuditContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestAuditContext | undefined {
    return this.storage.getStore();
  }
}

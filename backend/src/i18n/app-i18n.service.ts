import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AppI18nService {
  constructor(private readonly i18n: I18nService) {}

  t(key: string, args?: Record<string, unknown>): string {
    return this.i18n.t(key, args ? { args } : undefined);
  }

  common(key: string, args?: Record<string, unknown>): string {
    return this.t(`common.${key}`, args);
  }

  validation(key: string, args?: Record<string, unknown>): string {
    return this.t(`validation.${key}`, args);
  }

  notFound(attribute: string) {
    return this.validation('not_found', { attribute });
  }

  unique(attribute: string) {
    return this.validation('unique', { attribute });
  }
}

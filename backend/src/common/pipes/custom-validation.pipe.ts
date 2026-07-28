import {
  UnprocessableEntityException,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { defaultMetadataStorage } from 'class-transformer/cjs/storage';
import { ValidationError } from 'class-validator';
import { I18nContext } from 'nestjs-i18n';

function resolveFieldName(error: ValidationError): string {
  const target = error.target;

  if (!target) {
    return error.property;
  }

  const exposeMetadata = defaultMetadataStorage.findExposeMetadata(
    target.constructor,
    error.property,
  );

  return exposeMetadata?.options?.name || error.property;
}

function translateValidationMessage(message: string): string {
  const separatorIndex = message.indexOf('|');

  if (separatorIndex === -1) {
    return message;
  }

  const i18n = I18nContext.current();

  if (!i18n) {
    return message;
  }

  const key = message.slice(0, separatorIndex);
  const argsString = message.slice(separatorIndex + 1);

  try {
    const args = argsString ? JSON.parse(argsString) : {};

    return i18n.t(key, {
      lang: i18n.lang,
      args,
    });
  } catch {
    return message;
  }
}

function formatErrors(
  errors: ValidationError[],
  parentKey = '',
): Record<string, string[]> {
  let result: Record<string, string[]> = {};

  for (const error of errors) {
    const property = resolveFieldName(error);

    const field = parentKey ? `${parentKey}.${property}` : property;

    if (error.constraints) {
      result[field] = Object.values(error.constraints).map(
        translateValidationMessage,
      );
    }

    if (error.children && error.children.length > 0) {
      const childErrors = formatErrors(error.children, field);

      result = {
        ...result,
        ...childErrors,
      };
    }
  }

  return result;
}

function getFirstMessage(errors: Record<string, string[]>): string {
  const firstKey = Object.keys(errors)[0];
  return errors[firstKey]?.[0] || 'Validation failed';
}

function toLegacyFieldErrors(errors: Record<string, string[]>) {
  return Object.entries(errors).map(([name, messages]) => ({
    name,
    status: messages[0],
  }));
}

export class CustomValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      ...options,
      exceptionFactory: (errors) => {
        const formattedErrors = formatErrors(errors);
        const message = getFirstMessage(formattedErrors);

        return new UnprocessableEntityException({
          message,
          errors: formattedErrors,
          fieldErrors: toLegacyFieldErrors(formattedErrors),
        });
      },
    });
  }
}

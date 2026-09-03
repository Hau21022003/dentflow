import { UnprocessableEntityException } from '@nestjs/common';

export class RequestFieldValidationException extends UnprocessableEntityException {
  constructor(field: string, message: string) {
    super({
      message,
      errors: { [field]: [message] },
      fieldErrors: [{ name: field, status: message }],
    });
  }
}

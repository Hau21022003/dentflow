import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Validates an ISO calendar date (`YYYY-MM-DD`) is today or earlier in UTC.
 * Pair with `@IsDateString({ strict: true })` when the transport contract also
 * needs to reject malformed dates.
 */
export function IsNotFutureDate(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      name: 'isNotFutureDate',
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' &&
            value <= new Date().toISOString().slice(0, 10)
          );
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must not be in the future.`;
        },
      },
    });
  };
}

import { Transform } from 'class-transformer';

export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }) => {
    const input: unknown = value;
    const normalizedValue = typeof input === 'string' ? input.trim() : input;

    if (
      normalizedValue === true ||
      normalizedValue === 'true' ||
      normalizedValue === 1 ||
      normalizedValue === '1'
    ) {
      return true;
    }

    if (
      normalizedValue === false ||
      normalizedValue === 'false' ||
      normalizedValue === 0 ||
      normalizedValue === '0'
    ) {
      return false;
    }

    return input;
  });
}

import { Transform } from 'class-transformer';

export function ToLowerCase(): PropertyDecorator {
  return Transform(({ value }) => {
    const input: unknown = value;

    return typeof input === 'string' ? input.toLowerCase() : input;
  });
}

import { Transform } from 'class-transformer';

export function NormalizeWhitespace(): PropertyDecorator {
  return Transform(({ value }) => {
    const input: unknown = value;

    return typeof input === 'string'
      ? input.trim().replace(/\s+/g, ' ')
      : input;
  });
}

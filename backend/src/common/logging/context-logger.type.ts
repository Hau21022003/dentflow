export type ContextLogger = {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(
    event: string,
    exception: unknown,
    fields?: Record<string, unknown>,
  ): void;
};

type ResetEnvironment = Readonly<{
  ALLOW_DEV_DB_RESET?: string;
  NODE_ENV?: string;
}>;

export function assertDevelopmentDatabaseResetAllowed(
  environment: ResetEnvironment = process.env,
): void {
  if (environment.NODE_ENV !== 'development') {
    throw new Error(
      'Refusing to reset the database outside the development environment.',
    );
  }

  if (environment.ALLOW_DEV_DB_RESET !== 'true') {
    throw new Error(
      'Refusing to reset the development database. Set ALLOW_DEV_DB_RESET=true in .env.development to continue.',
    );
  }
}

import { assertDevelopmentDatabaseResetAllowed } from './dev-reset-guard';

describe('assertDevelopmentDatabaseResetAllowed', () => {
  it('allows a confirmed development reset', () => {
    expect(() =>
      assertDevelopmentDatabaseResetAllowed({
        NODE_ENV: 'development',
        ALLOW_DEV_DB_RESET: 'true',
      }),
    ).not.toThrow();
  });

  it.each(['test', 'staging', 'production'])(
    'rejects the %s environment',
    (nodeEnv) => {
      expect(() =>
        assertDevelopmentDatabaseResetAllowed({
          NODE_ENV: nodeEnv,
          ALLOW_DEV_DB_RESET: 'true',
        }),
      ).toThrow('outside the development environment');
    },
  );

  it('rejects development without explicit confirmation', () => {
    expect(() =>
      assertDevelopmentDatabaseResetAllowed({ NODE_ENV: 'development' }),
    ).toThrow('ALLOW_DEV_DB_RESET=true');
  });
});

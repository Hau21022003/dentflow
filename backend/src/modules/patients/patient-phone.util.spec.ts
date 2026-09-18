import { normalizePatientPhone } from './patient-phone.util';

describe('normalizePatientPhone', () => {
  it.each([
    ['090 123 4567', '+84901234567'],
    ['+84 901 234 567', '+84901234567'],
    ['+1 202 555 0123', '+12025550123'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizePatientPhone(input)).toBe(expected);
  });

  it.each(['', 'not-a-phone', '090123'])(
    'rejects invalid input %s',
    (input) => {
      expect(normalizePatientPhone(input)).toBeNull();
    },
  );
});

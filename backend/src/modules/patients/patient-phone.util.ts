import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const PATIENT_DEFAULT_PHONE_COUNTRY = 'VN' as const;

/**
 * Returns a canonical E.164 number for duplicate detection. Local numbers are
 * interpreted as Vietnamese; explicitly international input keeps its country.
 */
export function normalizePatientPhone(value: string): string | null {
  const parsed = parsePhoneNumberFromString(
    value,
    PATIENT_DEFAULT_PHONE_COUNTRY,
  );

  return parsed?.isValid() ? parsed.number : null;
}

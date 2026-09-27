import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsDateString, IsString, validate } from 'class-validator';
import { IsNotFutureDate } from './is-not-future-date.decorator';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { NormalizeWhitespace } from './normalize-whitespace.decorator';
import { ToBoolean } from './to-boolean.decorator';
import { ToLowerCase } from './to-lower-case.decorator';
import { Trim } from './trim.decorator';

class BooleanDto {
  @ToBoolean()
  @IsBoolean()
  value: boolean;
}

class TrimDto {
  @Trim()
  @IsString()
  value: string;
}

class LowerCaseDto {
  @ToLowerCase()
  @IsString()
  value: string;
}

class NormalizeWhitespaceDto {
  @NormalizeWhitespace()
  @IsString()
  value: string;
}

class NotFutureDateDto {
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  value: string;
}

describe('DTO decorators', () => {
  it.each([
    [true, true],
    [false, false],
    [1, true],
    [0, false],
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
    [' true ', true],
    [' 0 ', false],
  ])('transforms %p to %p with ToBoolean', async (value, expected) => {
    const dto = plainToInstance(BooleanDto, { value });

    expect(dto.value).toBe(expected);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['yes', '', {}, null])(
    'leaves unsupported boolean input %p for validation',
    async (value) => {
      const dto = plainToInstance(BooleanDto, { value });

      expect(dto.value).toEqual(value);
      await expect(validate(dto)).resolves.toHaveLength(1);
    },
  );

  it('trims string values with Trim', async () => {
    const dto = plainToInstance(TrimDto, { value: '  dentist@example.test  ' });

    expect(dto.value).toBe('dentist@example.test');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([42, null, undefined, {}])(
    'preserves non-string input %p with Trim for validation',
    async (value) => {
      const dto = plainToInstance(TrimDto, { value });

      expect(dto.value).toEqual(value);
      await expect(validate(dto)).resolves.toHaveLength(1);
    },
  );

  it('lowercases string values without trimming', async () => {
    const dto = plainToInstance(LowerCaseDto, { value: '  DENTFLOW  ' });

    expect(dto.value).toBe('  dentflow  ');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([42, null, undefined, {}])(
    'preserves non-string input %p with ToLowerCase for validation',
    async (value) => {
      const dto = plainToInstance(LowerCaseDto, { value });

      expect(dto.value).toEqual(value);
      await expect(validate(dto)).resolves.toHaveLength(1);
    },
  );

  it('trims and normalizes consecutive whitespace', async () => {
    const dto = plainToInstance(NormalizeWhitespaceDto, {
      value: '  Dental\t\nClinic  \r\n  ',
    });

    expect(dto.value).toBe('Dental Clinic');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('normalizes whitespace-only strings to an empty string', async () => {
    const dto = plainToInstance(NormalizeWhitespaceDto, { value: ' \t\n ' });

    expect(dto.value).toBe('');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([42, null, undefined, {}])(
    'preserves non-string input %p with NormalizeWhitespace for validation',
    async (value) => {
      const dto = plainToInstance(NormalizeWhitespaceDto, { value });

      expect(dto.value).toEqual(value);
      await expect(validate(dto)).resolves.toHaveLength(1);
    },
  );

  it('keeps LoginDto email trimming behavior', async () => {
    const dto = plainToInstance(LoginDto, {
      email: '  dentist@example.test  ',
      password: 'synthetic-demo-password',
    });

    expect(dto.email).toBe('dentist@example.test');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts an ISO calendar date that is today or in the past', async () => {
    const dto = plainToInstance(NotFutureDateDto, {
      value: new Date().toISOString().slice(0, 10),
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['2999-01-01', 'not-a-date'])(
    'rejects an invalid or future date %s',
    async (value) => {
      const dto = plainToInstance(NotFutureDateDto, { value });

      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );
});

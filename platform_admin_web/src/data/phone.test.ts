import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  countryByDialCode,
  displayPhone,
  flagOf,
  parsePhone,
  phoneProblem,
  phoneSearchForms,
  toE164,
} from './phone';
import { COMMON_COUNTRIES, PHONE_COUNTRIES, SUDAN } from './phoneCountries';

describe('country list', () => {
  it('matches the mobile app, country by country', () => {
    const dart = readFileSync(new URL('../../../lib/core/constants/phone_countries.dart', import.meta.url), 'utf8');
    const inApp = [...dart.matchAll(/PhoneCountry\(\s*'([A-Z]{2})',\s*'(\d+)'/g)].map((m) => `${m[1]}+${m[2]}`);
    expect(PHONE_COUNTRIES.map((c) => `${c.iso}+${c.dialCode}`)).toEqual(inApp);
    const common = /common = \[([^\]]*)\]/.exec(dart)![1].replace(/[' ]/g, '').split(',');
    expect(COMMON_COUNTRIES).toEqual(common);
  });

  it('has unique codes that fit E.164', () => {
    expect(new Set(PHONE_COUNTRIES.map((c) => c.iso)).size).toBe(PHONE_COUNTRIES.length);
    for (const c of PHONE_COUNTRIES) {
      expect(c.dialCode).toMatch(/^[1-9][0-9]{0,3}$/);
      expect(c.minLength).toBeLessThanOrEqual(c.maxLength);
      expect(c.dialCode.length + c.maxLength).toBeLessThanOrEqual(15);
    }
  });

  it('starts with Sudan, and a shared code belongs to its main country', () => {
    expect(SUDAN.iso).toBe('SD');
    expect(countryByDialCode('1')?.iso).toBe('US');
    expect(countryByDialCode('7')?.iso).toBe('RU');
    expect(flagOf(SUDAN)).toBe('🇸🇩');
  });
});

describe('parsePhone', () => {
  it('splits a saved number on its code', () => {
    expect(parsePhone('+249912345678')).toMatchObject({ country: { iso: 'SD' }, national: '912345678' });
    expect(parsePhone('00966 50 123 4567')).toMatchObject({ country: { iso: 'SA' }, national: '501234567' });
    expect(parsePhone('+18765551234')).toMatchObject({ country: { iso: 'JM' }, national: '5551234' });
  });

  it('reads numbers saved before the code was asked for as Sudanese', () => {
    for (const old of ['0912345678', '912345678', '249912345678']) {
      expect(toE164(parsePhone(old))).toBe('+249912345678');
    }
    expect(toE164(parsePhone(''))).toBe('');
  });
});

describe('phoneProblem', () => {
  it('needs 9 digits after +249', () => {
    expect(phoneProblem(parsePhone('0912345678'))).toBeNull();
    expect(phoneProblem({ country: SUDAN, national: '91234' })).toEqual({ kind: 'digits', count: 9, code: '+249' });
  });

  it('only asks for a number when it is required', () => {
    expect(phoneProblem(parsePhone(''))).toBeNull();
    expect(phoneProblem(parsePhone(''), true)).toEqual({ kind: 'required' });
  });
});

describe('showing and searching', () => {
  it('puts a space after the code and leaves old numbers alone', () => {
    expect(displayPhone('+249912345678')).toBe('+249 912345678');
    expect(displayPhone('0912345678')).toBe('0912345678');
    expect(displayPhone('')).toBe('');
  });

  it('finds a number by its local form', () => {
    expect(phoneSearchForms('+249912345678')).toContain('0912345678');
  });
});

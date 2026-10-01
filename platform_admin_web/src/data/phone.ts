import { PHONE_COUNTRIES, SUDAN, type PhoneCountry } from './phoneCountries';

/**
 * A phone number split into its country and its national number: the digits
 * after the dialling code, without the local trunk 0. Mirrors the mobile
 * app's lib/core/utils/phone_number.dart, so both save `+249912345678`.
 */
export interface PhoneNumber {
  country: PhoneCountry;
  /** Digits only. */
  national: string;
}

const digitsOf = (text: string) => text.replace(/[^0-9]/g, '');

export function countryByIso(iso: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.iso === iso);
}

/** The country that owns a dialling code; for a shared code, the main one. */
export function countryByDialCode(dialCode: string): PhoneCountry | undefined {
  const owners = PHONE_COUNTRIES.filter((c) => c.dialCode === dialCode);
  return owners.find((c) => !c.sharesCode) ?? owners[0];
}

/** The typed national number: digits only, the trunk 0 removed where dialled without it. */
export function cleanNational(typed: string, country: PhoneCountry): string {
  const digits = digitsOf(typed);
  return country.keepsLeadingZero ? digits : digits.replace(/^0+/, '');
}

/** Splits international digits (no `+`) on the longest dialling code that matches. */
export function splitInternational(digits: string): PhoneNumber | null {
  for (let length = 4; length >= 1; length--) {
    if (digits.length <= length) continue;
    const country = countryByDialCode(digits.slice(0, length));
    if (country) return { country, national: cleanNational(digits.slice(length), country) };
  }
  return null;
}

/**
 * Reads a saved or pasted number. `+249...` or `00249...` is split on its
 * code; a number saved before the code was asked for (`0912345678`) is
 * taken as Sudanese.
 */
export function parsePhone(raw: string | null | undefined, fallback: PhoneCountry = SUDAN): PhoneNumber {
  const text = (raw ?? '').trim();
  const digits = digitsOf(text);
  if (!digits) return { country: fallback, national: '' };

  const international = text.startsWith('+') ? digits : digits.startsWith('00') ? digits.slice(2) : null;
  if (international !== null) {
    return (
      splitInternational(international) ?? {
        country: fallback,
        national: cleanNational(international, fallback),
      }
    );
  }

  const code = fallback.dialCode;
  const rest = digits.length - code.length;
  if (digits.startsWith(code) && rest >= fallback.minLength && rest <= fallback.maxLength) {
    return { country: fallback, national: digits.slice(code.length) };
  }
  return { country: fallback, national: cleanNational(digits, fallback) };
}

/** The number as it is saved: `+249912345678`, or '' when there is none. */
export function toE164(number: PhoneNumber): string {
  return number.national ? `+${number.country.dialCode}${number.national}` : '';
}

export type PhoneProblem = { kind: 'required' } | { kind: 'digits'; count: number; code: string } | { kind: 'invalid' };

/** Why a number cannot be saved, or null when it can. */
export function phoneProblem(number: PhoneNumber, required = false): PhoneProblem | null {
  const { country, national } = number;
  if (!national) return required ? { kind: 'required' } : null;
  if (national.length >= country.minLength && national.length <= country.maxLength) return null;
  return country.minLength === country.maxLength
    ? { kind: 'digits', count: country.minLength, code: `+${country.dialCode}` }
    : { kind: 'invalid' };
}

/** A saved number shown to people: `+249 912345678`. An old number is shown as typed. */
export function displayPhone(raw: string | null | undefined): string {
  const text = (raw ?? '').trim();
  if (!text.startsWith('+')) return text;
  const number = parsePhone(text);
  return number.national ? `+${number.country.dialCode} ${number.national}` : text;
}

/** The forms of a saved number people search with: as saved, and dialled locally (`0912345678`). */
export function phoneSearchForms(raw: string | null | undefined): string[] {
  const text = (raw ?? '').trim();
  if (!text) return [];
  const number = parsePhone(text);
  if (!number.national) return [text];
  const local = number.country.keepsLeadingZero ? number.national : `0${number.national}`;
  return [text, toE164(number), local];
}

/** The flag emoji, built from the two regional-indicator letters. */
export function flagOf(country: PhoneCountry): string {
  return String.fromCodePoint(...[...country.iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

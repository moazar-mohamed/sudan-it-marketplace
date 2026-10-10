import { useId, useMemo, useState, type ReactNode } from 'react';
import {
  cleanNational,
  countryByIso,
  flagOf,
  parsePhone,
  phoneProblem,
  splitInternational,
  toE164,
  type PhoneProblem,
} from '../data/phone';
import { COMMON_COUNTRIES, PHONE_COUNTRIES } from '../data/phoneCountries';
import { useI18n } from '../i18n/I18nProvider';

/** Keeps `+249` in one piece, plus sign first, inside Arabic text. */
const keepLeftToRight = (text: string) => `${String.fromCodePoint(0x2066)}${text}${String.fromCodePoint(0x2069)}`;

/** Why the saved value cannot be saved yet, or null. */
export function phoneValueProblem(value: string, required = false): PhoneProblem | null {
  return phoneProblem(parsePhone(value), required);
}

/**
 * Phone input with its country code: the flag and `+249` are chosen from a
 * list at the start, the number is typed after it. `value` and `onChange`
 * carry the number as it is saved (`+249912345678`, or '').
 */
export function PhoneField({
  label,
  mark,
  value,
  onChange,
  required = false,
  showError = false,
  disabled = false,
}: {
  label: string;
  /** Beside the label: what the field asks (components/FieldMark.tsx). */
  mark?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  showError?: boolean;
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const labelId = useId();
  const errorId = useId();
  const [initial] = useState(() => parsePhone(value));
  const [iso, setIso] = useState(initial.country.iso);
  const [typed, setTyped] = useState(initial.national);
  const country = countryByIso(iso)!;

  const sorted = useMemo(() => {
    const name = (c: (typeof PHONE_COUNTRIES)[number]) => (locale === 'ar' ? c.ar : c.en);
    return [...PHONE_COUNTRIES].sort((a, b) => name(a).localeCompare(name(b), locale));
  }, [locale]);
  const nameOf = (c: (typeof PHONE_COUNTRIES)[number]) => (locale === 'ar' ? c.ar : c.en);

  const emit = (nextIso: string, nextTyped: string) => {
    const next = countryByIso(nextIso)!;
    onChange(toE164({ country: next, national: cleanNational(nextTyped, next) }));
  };

  const onType = (text: string) => {
    const trimmed = text.trim();
    // A whole number pasted with its code picks its country.
    if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
      const digits = trimmed.replace(/[^0-9]/g, '');
      const split = splitInternational(trimmed.startsWith('+') ? digits : digits.slice(2));
      if (split) {
        setIso(split.country.iso);
        setTyped(split.national);
        emit(split.country.iso, split.national);
        return;
      }
    }
    const allowed = text.replace(/[^0-9+\s]/g, '');
    setTyped(allowed);
    emit(iso, allowed);
  };

  const problem = phoneProblem({ country, national: cleanNational(typed, country) }, required);
  const error = !showError || !problem
    ? null
    : problem.kind === 'required'
      ? t('phone.required')
      : problem.kind === 'digits'
        ? t('phone.digitsExact', { count: String(problem.count), code: keepLeftToRight(problem.code) })
        : t('phone.invalid');

  return (
    <div className="field">
      <span id={labelId}>
        {label}
        {mark}
      </span>
      <div className="phone-input" dir="ltr">
        <div className="phone-input__code">
          <span aria-hidden="true">
            {flagOf(country)} +{country.dialCode}
          </span>
          <span aria-hidden="true" className="phone-input__caret">
            ▾
          </span>
          <select
            aria-label={t('phone.countryCode')}
            value={iso}
            disabled={disabled}
            onChange={(e) => {
              setIso(e.target.value);
              emit(e.target.value, typed);
            }}
          >
            <optgroup label={t('phone.common')}>
              {COMMON_COUNTRIES.map((code) => {
                const c = countryByIso(code)!;
                return (
                  <option key={`common-${code}`} value={code}>
                    {flagOf(c)} {nameOf(c)} (+{c.dialCode})
                  </option>
                );
              })}
            </optgroup>
            <optgroup label={t('phone.all')}>
              {sorted.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {flagOf(c)} {nameOf(c)} (+{c.dialCode})
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <input
          aria-labelledby={labelId}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          value={typed}
          onChange={(e) => onType(e.target.value)}
          placeholder={country.example}
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          maxLength={24}
        />
      </div>
      {error && (
        <small id={errorId} className="field__error">
          {error}
        </small>
      )}
    </div>
  );
}

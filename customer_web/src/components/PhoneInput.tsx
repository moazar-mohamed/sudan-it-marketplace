import { COMMON_COUNTRIES, PHONE_COUNTRIES } from '../data/phoneCountries';
import { cleanNational, countryByIso, flagOf, phoneProblem } from '../data/phone';
import type { PhoneNumber } from '../data/phone';

const common = COMMON_COUNTRIES.flatMap((iso) => PHONE_COUNTRIES.filter((c) => c.iso === iso));
const others = PHONE_COUNTRIES.filter((c) => !COMMON_COUNTRIES.includes(c.iso)).sort((a, b) => a.ar.localeCompare(b.ar, 'ar'));

/** Why [number] cannot be saved, in words; null when it can. */
export function phoneError(number: PhoneNumber, required = false): string | null {
  const problem = phoneProblem(number, required);
  if (!problem) return null;
  if (problem.kind === 'required') return 'رقم الهاتف مطلوب.';
  if (problem.kind === 'digits') return `أدخل ${problem.count} أرقام بعد ${problem.code}.`;
  return 'رقم الهاتف غير صحيح.';
}

export function PhoneInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: PhoneNumber;
  onChange: (next: PhoneNumber) => void;
  label: string;
  disabled?: boolean;
}) {
  const option = (c: (typeof PHONE_COUNTRIES)[number]) => (
    <option key={c.iso} value={c.iso}>{flagOf(c)} {c.ar} +{c.dialCode}</option>
  );
  return (
    <div className="field">
      <span id="phone-label">{label}</span>
      <div className="phone-row" dir="ltr">
        <select
          aria-label="مفتاح الدولة"
          disabled={disabled}
          value={value.country.iso}
          onChange={(e) => {
            const country = countryByIso(e.target.value) ?? value.country;
            onChange({ country, national: cleanNational(value.national, country) });
          }}
        >
          <optgroup label="الأكثر استخدامًا">{common.map(option)}</optgroup>
          <optgroup label="كل الدول">{others.map(option)}</optgroup>
        </select>
        <input
          aria-labelledby="phone-label"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={value.national}
          placeholder={value.country.example ?? ''}
          onChange={(e) => onChange({ ...value, national: cleanNational(e.target.value, value.country) })}
        />
      </div>
    </div>
  );
}

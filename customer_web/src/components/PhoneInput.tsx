import { COMMON_COUNTRIES, PHONE_COUNTRIES } from '../data/phoneCountries';
import { cleanNational, countryByIso, flagOf, phoneProblem } from '../data/phone';
import type { PhoneNumber } from '../data/phone';
import { language, t } from '../i18n';
import { Select } from './Select';

const common = COMMON_COUNTRIES.flatMap((iso) => PHONE_COUNTRIES.filter((c) => c.iso === iso));
const others = PHONE_COUNTRIES.filter((c) => !COMMON_COUNTRIES.includes(c.iso)).sort((a, b) => a.ar.localeCompare(b.ar, 'ar'));

/** Why [number] cannot be saved, in words; null when it can. */
export function phoneError(number: PhoneNumber, required = false): string | null {
  const problem = phoneProblem(number, required);
  if (!problem) return null;
  if (problem.kind === 'required') return t('رقم الهاتف مطلوب.');
  if (problem.kind === 'digits') return t('أدخل {0} أرقام بعد {1}.', problem.count, problem.code);
  return t('رقم الهاتف غير صحيح.');
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
  const option = (c: (typeof PHONE_COUNTRIES)[number], group: string) => ({
    value: c.iso,
    label: `${flagOf(c)} ${language === 'en' ? c.en : c.ar} +${c.dialCode}`,
    short: `${flagOf(c)} +${c.dialCode}`,
    group,
  });
  const options = [...common.map((c) => option(c, t('الأكثر استخدامًا'))), ...others.map((c) => option(c, t('كل الدول')))];
  return (
    <div className="field">
      <span id="phone-label">{label}</span>
      <div className="phone-row" dir="ltr">
        <Select
          ariaLabel={t('مفتاح الدولة')}
          disabled={disabled}
          dir="ltr"
          value={value.country.iso}
          options={options}
          onChange={(iso) => {
            const country = countryByIso(iso) ?? value.country;
            onChange({ country, national: cleanNational(value.national, country) });
          }}
        />
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

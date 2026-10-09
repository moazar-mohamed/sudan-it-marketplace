import { cityChoices, useCities } from '../data/cities';
import { useI18n } from '../i18n/I18nProvider';

/** Toggle buttons for the cities that can be chosen; `value` is the chosen city ids. */
export function CityChips({
  value,
  onChange,
  label,
}: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  label: string;
}) {
  const { locale } = useI18n();
  const cities = useCities();
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((c) => c !== id) : [...value, id]);
  return (
    <div className="chips" role="group" aria-label={label}>
      {cityChoices(cities, value).map((city) => {
        const on = value.includes(city.id);
        return (
          <button
            key={city.id}
            type="button"
            className={`chip${on ? ' chip--active' : ''}`}
            aria-pressed={on}
            onClick={() => toggle(city.id)}
          >
            {locale === 'ar' ? city.ar : city.en}
          </button>
        );
      })}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Icon, PATHS } from '../components/Icon';
import { useTheme } from '../theme';
import type { ThemeChoice } from '../theme';

const THEMES: { value: ThemeChoice; label: string; hint?: string }[] = [
  { value: 'system', label: 'حسب الجهاز', hint: 'يتبع إعداد جهازك' },
  { value: 'light', label: 'فاتح' },
  { value: 'dark', label: 'داكن' },
];

export function SettingsPage() {
  const { choice, pick } = useTheme();
  return (
    <main className="stack narrow">
      <h1 className="page-title">الإعدادات</h1>
      <section className="tile" aria-label="المظهر">
        <h2>المظهر</h2>
        {THEMES.map((t) => (
          <label key={t.value} className="check">
            <input type="radio" name="theme" checked={choice === t.value} onChange={() => pick(t.value)} />
            <span>
              {t.label}
              {t.hint && <span className="pmeta" style={{ display: 'block' }}>{t.hint}</span>}
            </span>
          </label>
        ))}
      </section>
      <h2 className="group-title">المساعدة</h2>
      <section className="rows" aria-label="المساعدة">
        <Link className="row" to="/reports/new">
          <Icon d={PATHS.flag} />
          <span className="grow">الإبلاغ عن مشكلة</span>
        </Link>
        <Link className="row" to="/reports">
          <Icon d={PATHS.box} />
          <span className="grow">بلاغاتي</span>
        </Link>
      </section>
    </main>
  );
}

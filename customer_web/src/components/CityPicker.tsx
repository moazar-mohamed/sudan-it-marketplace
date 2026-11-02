import { useMemo, useState } from 'react';
import { servesCity } from '../data/browse';
import { saveCity } from '../data/account';
import { useCatalog } from '../data/DataProvider';
import { companiesCount } from '../data/format';
import { Icon, PATHS } from './Icon';
import { cityName } from '../data/cities';
import { t } from '../i18n';

/** Chooses the one city the customer shops in. Without [onClose] a choice is required. */
export function CityPicker({ uid, selectedId, onClose }: { uid: string; selectedId: string | null; onClose?: () => void }) {
  const { cities, companies } = useCatalog();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const city of cities) map.set(city.id, companies.filter((c) => servesCity(c, city.id)).length);
    return map;
  }, [cities, companies]);

  const needle = query.trim().toLowerCase();
  const shown = cities.filter(
    (c) =>
      (c.active || c.id === selectedId) &&
      (needle === '' || c.nameAr.includes(needle) || c.nameEn.toLowerCase().includes(needle)),
  );

  async function choose(id: string) {
    if (busy) return;
    if (id === selectedId) {
      onClose?.();
      return;
    }
    setBusy(true);
    setFailed(false);
    const saved = await saveCity(uid, id);
    setBusy(false);
    if (saved) onClose?.();
    else setFailed(true);
  }

  const panel = (
    <div className="palette city-panel" role="dialog" aria-modal="true" aria-label={t('اختر مدينتك')}>
      <div className="city-head">
        <h2>{t('اختر مدينتك')}</h2>
        <p>{t('تظهر لك أولاً الشركات التي تخدم مدينتك، حتى تصلك طلباتك.')}</p>
        <label className="city-search">
          <Icon d={PATHS.search} size={18} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('ابحث عن مدينة')} aria-label={t('ابحث عن مدينة')} />
        </label>
        {failed && <div className="error" role="alert">{t('تعذّر حفظ مدينتك. حاول مرة أخرى.')}</div>}
      </div>
      <div className="palette-list">
        {shown.length === 0 && <div className="empty">{t('لا توجد مدينة بهذا الاسم.')}</div>}
        {shown.map((city) => (
          <button key={city.id} className={`item${city.id === selectedId ? ' on' : ''}`} disabled={busy} onClick={() => choose(city.id)}>
            <span className="grow">
              <span style={{ display: 'block', fontWeight: 700 }}>{cityName(city)}</span>
              <span className="pmeta">{companiesCount(counts.get(city.id) ?? 0)}</span>
            </span>
            {city.id === selectedId && <span className="price">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );

  if (!onClose) return panel;
  return (
    <div
      className="scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {panel}
    </div>
  );
}

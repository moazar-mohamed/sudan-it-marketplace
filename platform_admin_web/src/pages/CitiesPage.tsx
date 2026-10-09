import { useState } from 'react';
import { useRunner } from '../components/feedback';
import { Card, PageHeader } from '../components/ui';
import { saveCities } from '../data/actions';
import { newCityId, useCities, type SudanCity } from '../data/cities';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';

/** A city while it is being edited: the position is text until it is saved. */
interface Row {
  id: string;
  ar: string;
  en: string;
  lat: string;
  lng: string;
  active: boolean;
  /** Added in this edit (its id is still free to be taken out again). */
  added: boolean;
}

const toRow = (c: SudanCity): Row => ({
  id: c.id,
  ar: c.ar,
  en: c.en,
  lat: c.latitude === undefined ? '' : String(c.latitude),
  lng: c.longitude === undefined ? '' : String(c.longitude),
  active: c.active,
  added: false,
});

/** What is wrong with the rows, as a dictionary key, or null when they can be saved. */
export function rowsProblem(rows: readonly Row[]): TranslationKey | null {
  for (const r of rows) {
    if (!r.ar.trim() || !r.en.trim()) return 'cities.problem.names';
    const hasLat = r.lat.trim() !== '';
    const hasLng = r.lng.trim() !== '';
    if (hasLat !== hasLng) return 'cities.problem.point';
    if (hasLat) {
      const lat = Number(r.lat);
      const lng = Number(r.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return 'cities.problem.point';
      }
    }
  }
  return null;
}

/** The rows as cities to save. */
export function rowsToCities(rows: readonly Row[]): SudanCity[] {
  return rows.map((r) => ({
    id: r.id,
    ar: r.ar.trim(),
    en: r.en.trim(),
    active: r.active,
    ...(r.lat.trim() !== '' ? { latitude: Number(r.lat), longitude: Number(r.lng) } : {}),
  }));
}

/**
 * Platform Admin's list of cities: names, position and whether a city is shown.
 * A city is added or hidden, never deleted: companies and customers already
 * point at it.
 */
export function CitiesPage() {
  const { t } = useI18n();
  const saved = useCities();
  const { busy, run } = useRunner();
  const [draft, setDraft] = useState<Row[] | null>(null);
  const [newAr, setNewAr] = useState('');
  const [newEn, setNewEn] = useState('');
  const rows = draft ?? saved.map(toRow);
  const problem = rowsProblem(rows);

  const change = (id: string, patch: Partial<Row>) =>
    setDraft(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const add = () => {
    if (!newAr.trim() || !newEn.trim()) return;
    const id = newCityId(newEn, rows.map((r) => r.id));
    setDraft([...rows, { id, ar: newAr.trim(), en: newEn.trim(), lat: '', lng: '', active: true, added: true }]);
    setNewAr('');
    setNewEn('');
  };

  const save = async () => {
    if (problem) return;
    const ok = await run('save', () => saveCities(rowsToCities(rows)), t('cities.saved'));
    if (ok) setDraft(null);
  };

  return (
    <>
      <PageHeader
        title={t('cities.title')}
        subtitle={t('cities.subtitle')}
        actions={
          <button className="btn btn--primary" disabled={draft === null || problem !== null || busy === 'save'} onClick={save}>
            {busy === 'save' ? t('common.saving') : t('common.save')}
          </button>
        }
      />
      {problem && draft !== null && (
        <p className="field__error" role="alert">
          {t(problem)}
        </p>
      )}
      <Card title={t('cities.add')}>
        <div className="field-row">
          <label className="field">
            <span>{t('cities.col.nameAr')}</span>
            <input value={newAr} onChange={(e) => setNewAr(e.target.value)} dir="rtl" maxLength={60} />
          </label>
          <label className="field">
            <span>{t('cities.col.nameEn')}</span>
            <input value={newEn} onChange={(e) => setNewEn(e.target.value)} dir="ltr" maxLength={60} />
          </label>
          <div className="field">
            <span>&nbsp;</span>
            <button type="button" className="btn" disabled={!newAr.trim() || !newEn.trim()} onClick={add}>
              + {t('cities.add')}
            </button>
          </div>
        </div>
      </Card>
      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t('cities.col.nameAr')}</th>
                <th>{t('cities.col.nameEn')}</th>
                <th>{t('cities.col.lat')}</th>
                <th>{t('cities.col.lng')}</th>
                <th>{t('cities.col.shown')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input aria-label={t('cities.col.nameAr')} value={r.ar} dir="rtl" maxLength={60} onChange={(e) => change(r.id, { ar: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={t('cities.col.nameEn')} value={r.en} dir="ltr" maxLength={60} onChange={(e) => change(r.id, { en: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={t('cities.col.lat')} value={r.lat} dir="ltr" inputMode="decimal" onChange={(e) => change(r.id, { lat: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={t('cities.col.lng')} value={r.lng} dir="ltr" inputMode="decimal" onChange={(e) => change(r.id, { lng: e.target.value })} />
                  </td>
                  <td>
                    <input type="checkbox" aria-label={t('cities.col.shown')} checked={r.active} onChange={(e) => change(r.id, { active: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="note">{t('cities.note')}</p>
    </>
  );
}

import { useSyncExternalStore } from 'react';

/**
 * The cities customers and companies choose from. Platform Admin keeps the
 * list in `platform_settings/cities`; until it has saved one, the built-in
 * list (the same one the apps ship with, lib/features/cities/domain/sudan_city.dart)
 * is the list. The id is what Firestore stores in `companies/{id}.serviceCityIds`
 * and `users/{uid}.cityId`; it never changes once a city exists, and a city is
 * hidden (`active: false`), never deleted.
 */
export interface SudanCity {
  id: string;
  ar: string;
  en: string;
  /** False once hidden: it can no longer be chosen, what already has it keeps it. */
  active: boolean;
}

const city = (id: string, ar: string, en: string): SudanCity => ({
  id,
  ar,
  en,
  active: true,
});

export const BUILT_IN_CITIES: readonly SudanCity[] = [
  city('khartoum', 'الخرطوم', 'Khartoum'),
  city('omdurman', 'أم درمان', 'Omdurman'),
  city('bahri', 'الخرطوم بحري', 'Khartoum Bahri'),
  city('port_sudan', 'بورتسودان', 'Port Sudan'),
  city('wad_madani', 'ود مدني', 'Wad Madani'),
  city('kassala', 'كسلا', 'Kassala'),
  city('gedaref', 'القضارف', 'Gedaref'),
  city('atbara', 'عطبرة', 'Atbara'),
  city('shendi', 'شندي', 'Shendi'),
  city('ed_damer', 'الدامر', 'Ed Damer'),
  city('berber', 'بربر', 'Berber'),
  city('dongola', 'دنقلا', 'Dongola'),
  city('wadi_halfa', 'وادي حلفا', 'Wadi Halfa'),
  city('el_obeid', 'الأبيض', 'El Obeid'),
  city('kosti', 'كوستي', 'Kosti'),
  city('rabak', 'ربك', 'Rabak'),
  city('ed_dueim', 'الدويم', 'Ed Dueim'),
  city('sennar', 'سنار', 'Sennar'),
  city('singa', 'سنجة', 'Singa'),
  city('ed_damazin', 'الدمازين', 'Ed Damazin'),
  city('nyala', 'نيالا', 'Nyala'),
  city('el_fasher', 'الفاشر', 'El Fasher'),
  city('el_geneina', 'الجنينة', 'El Geneina'),
  city('zalingei', 'زالنجي', 'Zalingei'),
  city('ed_daein', 'الضعين', 'Ed Daein'),
  city('kadugli', 'كادقلي', 'Kadugli'),
  city('al_fula', 'الفولة', 'Al Fula'),
  city('tokar', 'طوكر', 'Tokar'),
];

/** The built-in list under its first name (the rules tests still use it). */
export const SUDAN_CITIES = BUILT_IN_CITIES;

// ── The list the panel works with ──────────────────────────────────────────

let directory: readonly SudanCity[] = BUILT_IN_CITIES;
const listeners = new Set<() => void>();

/** Replaces the list; an empty one keeps the built-in list. */
export function setCityDirectory(next: readonly SudanCity[]): void {
  directory = next.length > 0 ? next : BUILT_IN_CITIES;
  listeners.forEach((listener) => listener());
}

/** Every city, hidden ones too. */
export function allCities(): readonly SudanCity[] {
  return directory;
}

/** The list, kept current: the screens that show or pick a city read it with this. */
export function useCities(): readonly SudanCity[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => directory,
  );
}

/** What can be picked: the active cities, plus any hidden one that is already [selected]. */
export function cityChoices(cities: readonly SudanCity[], selected: readonly string[] = []): SudanCity[] {
  return cities.filter((c) => c.active || selected.includes(c.id));
}

/** One city of the saved list, or null when it is not a usable entry. */
export function parseCity(raw: unknown): SudanCity | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id === '') return null;
  const ar = typeof r.nameAr === 'string' ? r.nameAr.trim() : '';
  const en = typeof r.nameEn === 'string' ? r.nameEn.trim() : '';
  if (!ar && !en) return null;
  return {
    id: r.id,
    ar: ar || en,
    en: en || ar,
    active: r.active !== false,
  };
}

/** The cities of `platform_settings/cities`, or the built-in list when it holds none. */
export function citiesFromDocument(data: Record<string, unknown> | undefined): readonly SudanCity[] {
  const items = Array.isArray(data?.items) ? (data.items as unknown[]) : [];
  const seen = new Set<string>();
  const cities: SudanCity[] = [];
  for (const raw of items) {
    const parsed = parseCity(raw);
    if (parsed && !seen.has(parsed.id)) {
      seen.add(parsed.id);
      cities.push(parsed);
    }
  }
  return cities.length > 0 ? cities : BUILT_IN_CITIES;
}

/** A city as stored in `platform_settings/cities.items`. */
export function cityToItem(c: SudanCity): Record<string, unknown> {
  return {
    id: c.id,
    nameAr: c.ar,
    nameEn: c.en,
    active: c.active,
  };
}

/** A new, unused id for a city called [nameEn]: lower-case letters, digits and underscores. */
export function newCityId(nameEn: string, taken: readonly string[]): string {
  const base =
    nameEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'city';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}_${n}`;
  return id;
}

/** Keeps each id once: the cities of the list first, in list order, then any other id. */
export function normalizeCityIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const wanted = new Set(ids.filter((id): id is string => typeof id === 'string' && id !== ''));
  const known = new Set(directory.map((c) => c.id));
  return [...directory.filter((c) => wanted.has(c.id)).map((c) => c.id), ...[...wanted].filter((id) => !known.has(id))];
}

/** The names of [ids] in [locale], joined for display. Unknown ids are skipped. */
export function cityNames(ids: readonly string[], locale: 'ar' | 'en'): string {
  const wanted = new Set(ids);
  return directory
    .filter((c) => wanted.has(c.id))
    .map((c) => c[locale])
    .join(locale === 'ar' ? '، ' : ', ');
}

import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { language } from '../i18n';

export interface City {
  id: string;
  ar: string;
  en: string;
  active: boolean;
}

const c = (id: string, ar: string, en: string): City => ({ id, ar, en, active: true });

/** The list the apps ship with, until Platform Admin saves its own (platform_settings/cities). */
export const BUILT_IN_CITIES: City[] = [
  c('khartoum', 'الخرطوم', 'Khartoum'),
  c('omdurman', 'أم درمان', 'Omdurman'),
  c('bahri', 'الخرطوم بحري', 'Khartoum Bahri'),
  c('port_sudan', 'بورتسودان', 'Port Sudan'),
  c('wad_madani', 'ود مدني', 'Wad Madani'),
  c('kassala', 'كسلا', 'Kassala'),
  c('gedaref', 'القضارف', 'Gedaref'),
  c('atbara', 'عطبرة', 'Atbara'),
  c('shendi', 'شندي', 'Shendi'),
  c('ed_damer', 'الدامر', 'Ed Damer'),
  c('berber', 'بربر', 'Berber'),
  c('dongola', 'دنقلا', 'Dongola'),
  c('wadi_halfa', 'وادي حلفا', 'Wadi Halfa'),
  c('el_obeid', 'الأبيض', 'El Obeid'),
  c('kosti', 'كوستي', 'Kosti'),
  c('rabak', 'ربك', 'Rabak'),
  c('ed_dueim', 'الدويم', 'Ed Dueim'),
  c('sennar', 'سنار', 'Sennar'),
  c('singa', 'سنجة', 'Singa'),
  c('ed_damazin', 'الدمازين', 'Ed Damazin'),
  c('nyala', 'نيالا', 'Nyala'),
  c('el_fasher', 'الفاشر', 'El Fasher'),
  c('el_geneina', 'الجنينة', 'El Geneina'),
  c('zalingei', 'زالنجي', 'Zalingei'),
  c('ed_daein', 'الضعين', 'Ed Daein'),
  c('kadugli', 'كادقلي', 'Kadugli'),
  c('al_fula', 'الفولة', 'Al Fula'),
  c('tokar', 'طوكر', 'Tokar'),
];

function parse(data: Record<string, unknown> | undefined): City[] {
  const items = Array.isArray(data?.items) ? (data.items as unknown[]) : [];
  const seen = new Set<string>();
  const out: City[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id || seen.has(r.id)) continue;
    const ar = typeof r.nameAr === 'string' ? r.nameAr.trim() : '';
    const en = typeof r.nameEn === 'string' ? r.nameEn.trim() : '';
    if (!ar && !en) continue;
    seen.add(r.id);
    out.push({ id: r.id, ar: ar || en, en: en || ar, active: r.active !== false });
  }
  return out.length > 0 ? out : BUILT_IN_CITIES;
}

/** The cities customers and companies choose from (read once). */
export function useCities(): City[] {
  const [cities, setCities] = useState<City[]>(BUILT_IN_CITIES);
  useEffect(() => {
    let live = true;
    getDoc(doc(db, 'platform_settings', 'cities'))
      .then((s) => live && setCities(parse(s.data())))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return cities;
}

/** What can be picked: the active cities, plus any hidden one the company already has. */
export const cityChoicesFor = (cities: City[], selected: string[]): City[] => cities.filter((c) => c.active || selected.includes(c.id));

/** The city's name in the panel's language. */
export const cityLabel = (c: City): string => (language === 'en' ? c.en || c.ar : c.ar);

export const cityName = (cities: City[], id: string | null): string => {
  const city = id ? cities.find((x) => x.id === id) : undefined;
  return id ? (city ? cityLabel(city) : id) : '';
};

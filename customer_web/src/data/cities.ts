import { mapCity } from './mappers';
import type { City } from './types';

const raw: [string, string, string][] = [
  ['khartoum', 'الخرطوم', 'Khartoum'],
  ['omdurman', 'أم درمان', 'Omdurman'],
  ['bahri', 'الخرطوم بحري', 'Khartoum Bahri'],
  ['port_sudan', 'بورتسودان', 'Port Sudan'],
  ['wad_madani', 'ود مدني', 'Wad Madani'],
  ['kassala', 'كسلا', 'Kassala'],
  ['gedaref', 'القضارف', 'Gedaref'],
  ['atbara', 'عطبرة', 'Atbara'],
  ['shendi', 'شندي', 'Shendi'],
  ['ed_damer', 'الدامر', 'Ed Damer'],
  ['berber', 'بربر', 'Berber'],
  ['dongola', 'دنقلا', 'Dongola'],
  ['wadi_halfa', 'وادي حلفا', 'Wadi Halfa'],
  ['el_obeid', 'الأبيض', 'El Obeid'],
  ['kosti', 'كوستي', 'Kosti'],
  ['rabak', 'ربك', 'Rabak'],
  ['ed_dueim', 'الدويم', 'Ed Dueim'],
  ['sennar', 'سنار', 'Sennar'],
  ['singa', 'سنجة', 'Singa'],
  ['ed_damazin', 'الدمازين', 'Ed Damazin'],
  ['nyala', 'نيالا', 'Nyala'],
  ['el_fasher', 'الفاشر', 'El Fasher'],
  ['el_geneina', 'الجنينة', 'El Geneina'],
  ['zalingei', 'زالنجي', 'Zalingei'],
  ['ed_daein', 'الضعين', 'Ed Daein'],
  ['kadugli', 'كادقلي', 'Kadugli'],
  ['al_fula', 'الفولة', 'Al Fula'],
  ['tokar', 'طوكر', 'Tokar'],
];

/** The list the app ships with, until `platform_settings/cities` is read. */
export const BUILT_IN_CITIES: City[] = raw.map(([id, nameAr, nameEn]) => ({ id, nameAr, nameEn, active: true }));

/** The saved cities, or the built-in list when nothing usable is stored. */
export function citiesFromDocument(data: { items?: unknown } | undefined): City[] {
  if (!Array.isArray(data?.items)) return BUILT_IN_CITIES;
  const seen = new Set<string>();
  const cities: City[] = [];
  for (const entry of data.items) {
    const city = mapCity(entry);
    if (city && !seen.has(city.id)) {
      seen.add(city.id);
      cities.push(city);
    }
  }
  return cities.length > 0 ? cities : BUILT_IN_CITIES;
}

/** "الخرطوم، كسلا": the names of [ids]; unknown ids are skipped. */
export function cityNamesText(ids: string[], cities: City[]): string {
  return ids
    .map((id) => cities.find((c) => c.id === id)?.nameAr)
    .filter(Boolean)
    .join('، ');
}

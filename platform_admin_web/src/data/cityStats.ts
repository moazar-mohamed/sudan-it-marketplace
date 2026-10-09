import { collection, getCountFromServer, query, where, type Firestore } from 'firebase/firestore';
import type { SudanCity } from './cities';
import type { Company } from './types';

/** How many customers chose each city, and how many chose none yet. */
export interface CityCustomerCounts {
  byCity: Record<string, number>;
  noCity: number;
}

/**
 * Counts customers per city on the server (one count query per city, plus the
 * total), so a long customer list is never downloaded. The users rules allow a
 * Platform Admin to list customers when the query filters on role.
 */
export async function fetchCityCustomerCounts(db: Firestore, cities: readonly SudanCity[]): Promise<CityCustomerCounts> {
  const customers = query(collection(db, 'users'), where('role', '==', 'customer'));
  const [total, ...perCity] = await Promise.all([
    getCountFromServer(customers).then((s) => s.data().count),
    ...cities.map((city) =>
      getCountFromServer(query(customers, where('cityId', '==', city.id))).then((s) => s.data().count),
    ),
  ]);
  const byCity: Record<string, number> = {};
  cities.forEach((city, i) => {
    byCity[city.id] = perCity[i];
  });
  const chosen = perCity.reduce((a, b) => a + b, 0);
  return { byCity, noCity: Math.max(0, total - chosen) };
}

/** A company serves a city when it lists it, or lists none (it serves every city). */
export function companyServesCity(company: Pick<Company, 'serviceCityIds'>, cityId: string): boolean {
  const ids = company.serviceCityIds ?? [];
  return ids.length === 0 || ids.includes(cityId);
}

/** Active companies that serve [cityId]. */
export function companiesServing(companies: readonly Company[], cityId: string): number {
  return companies.filter((c) => c.status === 'active' && companyServesCity(c, cityId)).length;
}

/** Active companies that have not said which cities they serve. */
export function companiesWithoutCities(companies: readonly Company[]): number {
  return companies.filter((c) => c.status === 'active' && (c.serviceCityIds ?? []).length === 0).length;
}

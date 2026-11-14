import { describe, expect, it } from 'vitest';
import { cityNames, normalizeCityIds, SUDAN_CITIES } from './cities';
import { companiesServing, companiesWithoutCities, companyServesCity } from './cityStats';
import { mapCompany, mapCustomer } from './mappers';

const company = (id: string, extra: Record<string, unknown> = {}) =>
  mapCompany(id, { name: id, status: 'active', ...extra });

describe('city list', () => {
  it('has unique ids and Arabic and English names', () => {
    const ids = SUDAN_CITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const city of SUDAN_CITIES) {
      expect(city.ar).not.toBe('');
      expect(city.en).not.toBe('');
    }
  });

  it('normalizeCityIds keeps each id once, list cities first in list order', () => {
    expect(normalizeCityIds(['bahri', 'khartoum', 'mars', 'bahri', 5])).toEqual(['khartoum', 'bahri', 'mars']);
    expect(normalizeCityIds('khartoum')).toEqual([]);
    expect(normalizeCityIds(undefined)).toEqual([]);
  });

  it('cityNames joins names in the language', () => {
    expect(cityNames(['khartoum', 'omdurman'], 'en')).toBe('Khartoum, Omdurman');
    expect(cityNames(['khartoum', 'omdurman'], 'ar')).toBe('الخرطوم، أم درمان');
  });
});

describe('which companies serve a city', () => {
  const companies = [
    company('listed', { serviceCityIds: ['khartoum', 'bahri'] }),
    company('other', { serviceCityIds: ['port_sudan'] }),
    company('everywhere'),
    company('off', { status: 'inactive', serviceCityIds: ['khartoum'] }),
  ];

  it('a company that lists no city serves every city', () => {
    expect(companyServesCity(companies[2], 'nyala')).toBe(true);
    expect(companyServesCity(companies[0], 'nyala')).toBe(false);
  });

  it('counts only active companies, those listing the city and those listing none', () => {
    expect(companiesServing(companies, 'khartoum')).toBe(2);
    expect(companiesServing(companies, 'port_sudan')).toBe(2);
    expect(companiesServing(companies, 'nyala')).toBe(1);
  });

  it('counts active companies that have not set their cities', () => {
    expect(companiesWithoutCities(companies)).toBe(1);
  });
});

describe('reading stored data', () => {
  it('mapCompany reads and cleans serviceCityIds', () => {
    expect(company('c', { serviceCityIds: ['bahri', 'x', 'khartoum'] }).serviceCityIds).toEqual(['khartoum', 'bahri', 'x']);
    expect(company('c').serviceCityIds).toEqual([]);
  });

  it('mapCustomer keeps the saved city id', () => {
    expect(mapCustomer('u', { fullName: 'A', cityId: 'kassala' }).cityId).toBe('kassala');
    expect(mapCustomer('u', { fullName: 'A', cityId: 'mars' }).cityId).toBe('mars');
    expect(mapCustomer('u', { fullName: 'A' }).cityId).toBe('');
  });
});

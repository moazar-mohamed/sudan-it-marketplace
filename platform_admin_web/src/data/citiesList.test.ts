import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILT_IN_CITIES,
  cityChoices,
  cityNames,
  cityToItem,
  citiesFromDocument,
  newCityId,
  normalizeCityIds,
  parseCity,
  setCityDirectory,
} from './cities';
import { rowsProblem, rowsToCities } from '../pages/CitiesPage';

afterEach(() => setCityDirectory([]));

describe('the list of cities Platform Admin keeps', () => {
  it('is read from the saved document, hidden cities and all', () => {
    const cities = citiesFromDocument({
      items: [
        { id: 'atlantis', nameAr: 'أطلنطس', nameEn: 'Atlantis', latitude: 10, longitude: 20 },
        { id: 'camelot', nameAr: '', nameEn: 'Camelot', active: false },
        { id: '', nameEn: 'No id' },
        { id: 'nameless' },
        'junk',
        { id: 'atlantis', nameEn: 'Again' },
      ],
    });
    expect(cities.map((c) => c.id)).toEqual(['atlantis', 'camelot']);
    expect(cities[0]).toMatchObject({ ar: 'أطلنطس', latitude: 10, longitude: 20, active: true });
    expect(cities[1]).toMatchObject({ ar: 'Camelot', active: false });
    expect(cities[1].latitude).toBeUndefined();
  });

  it('is the built-in list when nothing usable is saved', () => {
    expect(citiesFromDocument(undefined)).toBe(BUILT_IN_CITIES);
    expect(citiesFromDocument({ items: [] })).toBe(BUILT_IN_CITIES);
    expect(citiesFromDocument({ items: 'x' })).toBe(BUILT_IN_CITIES);
  });

  it('a position needs both numbers', () => {
    expect(parseCity({ id: 'a', nameEn: 'A', latitude: 1 })?.latitude).toBeUndefined();
    expect(parseCity({ id: 'a', nameEn: 'A', latitude: 1, longitude: 2 })).toMatchObject({ latitude: 1, longitude: 2 });
  });

  it('round-trips through the stored item', () => {
    const [khartoum] = BUILT_IN_CITIES;
    expect(parseCity(cityToItem(khartoum))).toEqual(khartoum);
  });

  it('names and normalising follow the list once it is set', () => {
    setCityDirectory(
      citiesFromDocument({ items: [{ id: 'atlantis', nameAr: 'أطلنطس', nameEn: 'Atlantis' }] }),
    );
    expect(cityNames(['atlantis', 'khartoum'], 'en')).toBe('Atlantis');
    expect(normalizeCityIds(['khartoum', 'atlantis'])).toEqual(['atlantis', 'khartoum']);
  });

  it('only active cities can be picked, plus a hidden one already chosen', () => {
    const list = [
      { id: 'a', ar: 'أ', en: 'A', active: true },
      { id: 'b', ar: 'ب', en: 'B', active: false },
      { id: 'c', ar: 'ج', en: 'C', active: false },
    ];
    expect(cityChoices(list).map((c) => c.id)).toEqual(['a']);
    expect(cityChoices(list, ['c']).map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('a new city gets a free id made of letters, digits and underscores', () => {
    expect(newCityId('Port Sudan 2', [])).toBe('port_sudan_2');
    expect(newCityId('Khartoum', ['khartoum'])).toBe('khartoum_2');
    expect(newCityId('Khartoum', ['khartoum', 'khartoum_2'])).toBe('khartoum_3');
    expect(newCityId('!!!', [])).toBe('city');
  });
});

describe('editing the list', () => {
  const row = (extra: Record<string, unknown> = {}) => ({
    id: 'x', ar: 'س', en: 'X', lat: '', lng: '', active: true, added: false, ...extra,
  });

  it('every city needs both names', () => {
    expect(rowsProblem([row()])).toBeNull();
    expect(rowsProblem([row({ ar: ' ' })])).toBe('cities.problem.names');
    expect(rowsProblem([row({ en: '' })])).toBe('cities.problem.names');
  });

  it('the position is both numbers in range, or neither', () => {
    expect(rowsProblem([row({ lat: '15.5', lng: '32.5' })])).toBeNull();
    expect(rowsProblem([row({ lat: '15.5' })])).toBe('cities.problem.point');
    expect(rowsProblem([row({ lat: 'abc', lng: '1' })])).toBe('cities.problem.point');
    expect(rowsProblem([row({ lat: '95', lng: '1' })])).toBe('cities.problem.point');
  });

  it('becomes the cities to save, trimmed, with a position only when given', () => {
    expect(rowsToCities([row({ ar: ' س ', lat: '1', lng: '2' }), row({ id: 'y' })])).toEqual([
      { id: 'x', ar: 'س', en: 'X', active: true, latitude: 1, longitude: 2 },
      { id: 'y', ar: 'س', en: 'X', active: true },
    ]);
  });
});

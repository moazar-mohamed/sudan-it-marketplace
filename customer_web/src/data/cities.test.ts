import { describe, expect, it } from 'vitest';
import { BUILT_IN_CITIES, localCityText } from './cities';
import type { City } from './types';

// The site runs in Arabic here (no language chosen).
describe('localCityText', () => {
  it('shows a known city in the site language, however the company typed it', () => {
    expect(localCityText('Khartoum', BUILT_IN_CITIES)).toBe('الخرطوم');
    expect(localCityText('khartoum', BUILT_IN_CITIES)).toBe('الخرطوم');
    expect(localCityText('  الخرطوم ', BUILT_IN_CITIES)).toBe('الخرطوم');
    expect(localCityText('Port-Sudan', BUILT_IN_CITIES)).toBe('بورتسودان');
    expect(localCityText('port_sudan', BUILT_IN_CITIES)).toBe('بورتسودان');
  });

  it('corrects a city typed without its space or hamza', () => {
    expect(localCityText('أمدرمان', BUILT_IN_CITIES)).toBe('أم درمان');
    expect(localCityText('ام درمان', BUILT_IN_CITIES)).toBe('أم درمان');
    expect(localCityText('الابيض', BUILT_IN_CITIES)).toBe('الأبيض');
    expect(localCityText('Omdurman', BUILT_IN_CITIES)).toBe('أم درمان');
  });

  it('uses the platform list first, then the built-in one', () => {
    const platform: City[] = [{ id: 'juba', nameAr: 'جوبا', nameEn: 'Juba', active: true }];
    expect(localCityText('Juba', platform)).toBe('جوبا');
    expect(localCityText('Kassala', platform)).toBe('كسلا');
  });

  it('keeps any other text as typed, and nothing as nothing', () => {
    expect(localCityText('Souq Arabi, Khartoum 2', BUILT_IN_CITIES)).toBe('Souq Arabi, Khartoum 2');
    expect(localCityText('', BUILT_IN_CITIES)).toBe('');
    expect(localCityText('   ', BUILT_IN_CITIES)).toBe('');
  });
});

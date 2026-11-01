import { describe, expect, it } from 'vitest';
import { searchRanked, suggestCorrection } from './searchRanking';
import type { SearchField } from './searchRanking';

// The same cases as test/search_ranking_test.dart: the app and the site must agree.

interface Item {
  name: string;
  category?: string;
  description?: string;
}

const fields = (item: Item): SearchField[] => [
  { text: item.name, weight: 3 },
  { text: item.category ?? '', weight: 2 },
  { text: item.description ?? '' },
];

const names = (items: Item[], query: string) => searchRanked(items, query, fields).map((i) => i.name);

const dell = { name: 'Dell Laptop', category: 'Laptops' };
const hp = { name: 'HP Laptop 15', category: 'Laptops' };
const router = { name: 'TP-Link Router', category: 'Networking' };
const cable = { name: 'Cat6 UTP Cable Box', category: 'Networking', description: 'For laptop docking and router uplinks' };
const camera = { name: 'Hikvision 4MP IP Dome Camera', category: 'Security' };
const printer = { name: 'HP LaserJet Printer', category: 'Printers' };
const all = [dell, hp, router, cable, camera, printer];

describe('words', () => {
  it('keeps everything in order for an empty query', () => {
    expect(names(all, '')).toEqual(all.map((i) => i.name));
    expect(names(all, '   ')).toEqual(all.map((i) => i.name));
  });

  it('needs every word, in any order', () => {
    expect(names(all, 'laptop dell')).toEqual(['Dell Laptop']);
    expect(names(all, 'dell hp')).toEqual([]);
  });

  it('matches a start or the inside of a word', () => {
    expect(names(all, 'route')[0]).toBe('TP-Link Router');
    expect(names(all, 'link')).toEqual(['TP-Link Router', 'Cat6 UTP Cable Box']);
  });

  it('ignores punctuation and case', () => {
    expect(names(all, 'TP LINK')[0]).toBe('TP-Link Router');
    expect(names(all, 'tplink')[0]).toBe('TP-Link Router');
    expect(names(all, 'wifi router')).toEqual([]);
  });

  it('matches in every field', () => {
    expect(names(all, 'docking')).toEqual(['Cat6 UTP Cable Box']);
    expect(names(all, 'security')).toEqual(['Hikvision 4MP IP Dome Camera']);
  });
});

describe('ranking', () => {
  it('puts a name hit above a description hit', () => {
    const ranked = names(all, 'router');
    expect(ranked[0]).toBe('TP-Link Router');
    expect(ranked).toContain('Cat6 UTP Cable Box');
  });

  it('puts an exact word above a partial one', () => {
    expect(names([{ name: 'Laptops bag' }, { name: 'Laptop' }], 'laptop')[0]).toBe('Laptop');
  });

  it('puts the whole phrase above the words apart', () => {
    expect(names([{ name: 'Laptop Dell' }, { name: 'Dell Laptop' }], 'dell laptop')).toEqual(['Dell Laptop', 'Laptop Dell']);
  });

  it('keeps the original order on equal scores', () => {
    expect(names([hp, dell], 'laptop')).toEqual(['HP Laptop 15', 'Dell Laptop']);
  });
});

describe('typos', () => {
  it('forgives one wrong, missing, extra or swapped letter', () => {
    for (const typo of ['laptob', 'lptop', 'laptopp', 'lapotp']) {
      expect(names(all, typo)).toContain('Dell Laptop');
    }
  });

  it('does not guess at short or unrelated words', () => {
    expect(names(all, 'hq')).toEqual([]);
    expect(names(all, 'refrigerator')).toEqual([]);
  });
});

describe('Arabic', () => {
  it('ignores diacritics, alef and teh marbuta variants', () => {
    expect(names([{ name: 'طابعة ليزر' }], 'طابعه')).toEqual(['طابعة ليزر']);
    expect(names([{ name: 'طابعة ليزر' }], 'طَابِعَة')).toEqual(['طابعة ليزر']);
    expect(names([{ name: 'أجهزة حاسوب' }], 'اجهزه')).toEqual(['أجهزة حاسوب']);
  });

  it('ignores the definite article on either side', () => {
    expect(names([{ name: 'الطابعة الملونة' }], 'طابعة')).toEqual(['الطابعة الملونة']);
    expect(names([{ name: 'طابعة ملونة' }], 'الطابعة')).toEqual(['طابعة ملونة']);
  });

  it('finds Arabic and English spellings of a product', () => {
    expect(names(all, 'لابتوب')).toEqual(expect.arrayContaining(['Dell Laptop', 'HP Laptop 15']));
    expect(names(all, 'لاب توب')).toContain('Dell Laptop');
    expect(names(all, 'راوتر')).toContain('TP-Link Router');
    expect(names(all, 'طابعة')).toEqual(['HP LaserJet Printer']);
    expect(names(all, 'كيبل')).toEqual(['Cat6 UTP Cable Box']);
    expect(names(all, 'كاميرا')).toEqual(['Hikvision 4MP IP Dome Camera']);

    const arabic = [{ name: 'لابتوب ديل' }, { name: 'راوتر واي فاي' }, { name: 'كاميرا مراقبة خارجية' }];
    expect(names(arabic, 'laptop')).toEqual(['لابتوب ديل']);
    expect(names(arabic, 'router')).toEqual(['راوتر واي فاي']);
    expect(names(arabic, 'wifi')).toEqual(['راوتر واي فاي']);
    expect(names(arabic, 'wi-fi')).toEqual(['راوتر واي فاي']);
    expect(names(arabic, 'cctv')).toEqual(['كاميرا مراقبة خارجية']);
  });

  it('never rewrites the inside of another word', () => {
    const items = [{ name: 'Study groups planner' }, { name: 'APC UPS 1500VA' }];
    expect(names(items, 'ups')).toEqual(['APC UPS 1500VA', 'Study groups planner']);
    expect(names(items, 'يو بي اس')).toEqual(['APC UPS 1500VA', 'Study groups planner']);
  });

  it('finds English brand names from Arabic spellings', () => {
    const items = [{ name: 'HP LaserJet Printer' }, { name: 'Hikvision 4MP Camera' }, { name: 'TP-Link Archer Router' }];
    expect(names(items, 'اتش بي')).toEqual(['HP LaserJet Printer']);
    expect(names(items, 'هيكفيجن')).toEqual(['Hikvision 4MP Camera']);
    expect(names(items, 'تي بي لينك')).toEqual(['TP-Link Archer Router']);
  });
});

describe('did you mean', () => {
  const vocabulary = ['Dell Laptop', 'TP-Link Router', 'Cisco Switch', 'Networks'];

  it('fixes a word that matches nothing', () => {
    expect(suggestCorrection('lapotp', vocabulary)).toBe('laptop');
    expect(suggestCorrection('swtich', vocabulary)).toBe('switch');
    expect(suggestCorrection('dell lptop', vocabulary)).toBe('dell laptop');
  });

  it('leaves a query that already matches alone', () => {
    expect(suggestCorrection('lapt', vocabulary)).toBeNull();
    expect(suggestCorrection('router', vocabulary)).toBeNull();
    expect(suggestCorrection('', vocabulary)).toBeNull();
  });

  it('does not guess when nothing is close', () => {
    expect(suggestCorrection('xyzxyz', vocabulary)).toBeNull();
    expect(suggestCorrection('laptop', [])).toBeNull();
  });
});

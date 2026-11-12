import { describe, expect, it } from 'vitest';
import { itemsCount, piecesCount } from './format';

// Arabic counted nouns: one, two, 3 to 10 (plural), 11 and more (singular).
describe('itemsCount / piecesCount', () => {
  it('uses the right Arabic form for each number', () => {
    expect(itemsCount(1)).toBe('عنصر واحد');
    expect(itemsCount(2)).toBe('عنصران');
    expect(itemsCount(5)).toBe('5 عناصر');
    expect(itemsCount(10)).toBe('10 عناصر');
    expect(itemsCount(11)).toBe('11 عنصر');
    expect(piecesCount(1)).toBe('قطعة واحدة');
    expect(piecesCount(2)).toBe('قطعتان');
    expect(piecesCount(3)).toBe('3 قطع');
    expect(piecesCount(25)).toBe('25 قطعة');
  });
});

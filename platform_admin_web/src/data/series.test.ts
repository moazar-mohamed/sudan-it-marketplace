import { describe, expect, it } from 'vitest';
import { compareWindows, dailySeries, percentChange, PERIOD_DAYS } from './stats';

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW - days * DAY);
const dateOf = (d: Date) => d;

describe('the daily series behind the dashboard sparklines and chart', () => {
  it('has one slot per day, oldest first, newest last', () => {
    const series = dailySeries([ago(0.5), ago(1.5), ago(1.6), ago(6.5)], dateOf, NOW, 7);
    expect(series).toEqual([1, 0, 0, 0, 0, 2, 1]);
  });

  it('adds up to exactly the period total, for every period the page offers', () => {
    const items = Array.from({ length: 200 }, (_, i) => ago((i * 37) % 70));
    for (const days of PERIOD_DAYS) {
      const total = dailySeries(items, dateOf, NOW, days).reduce((a, b) => a + b, 0);
      expect(total, `${days} days`).toBe(compareWindows(items, dateOf, NOW, undefined, days).current);
    }
  });

  it('adds up money the same way', () => {
    const items = [
      { at: ago(0.2), amount: 100 },
      { at: ago(3), amount: 250 },
      { at: ago(9), amount: 40 },
    ];
    const series = dailySeries(items, (i) => i.at, NOW, 14, (i) => i.amount);
    expect(series.reduce((a, b) => a + b, 0)).toBe(390);
    expect(compareWindows(items, (i) => i.at, NOW, (i) => i.amount, 14).current).toBe(390);
  });

  it('puts an item exactly at the start of the period in the oldest slot, like the period total does', () => {
    const series = dailySeries([ago(7)], dateOf, NOW, 7);
    expect(series[0]).toBe(1);
    expect(compareWindows([ago(7)], dateOf, NOW, undefined, 7).current).toBe(1);
  });

  it('leaves out what is older than the period, in the future or undated', () => {
    const series = dailySeries([ago(7.1), new Date(NOW + 1000), null], (d) => d, NOW, 7);
    expect(series.every((v) => v === 0)).toBe(true);
  });
});

describe('comparing a period with the one before it', () => {
  it('uses the period length for both windows', () => {
    const items = [ago(1), ago(2), ago(8), ago(9), ago(10), ago(16), ago(40)];
    expect(compareWindows(items, dateOf, NOW, undefined, 7)).toEqual({ current: 2, previous: 3 });
    expect(compareWindows(items, dateOf, NOW, undefined, 14)).toEqual({ current: 5, previous: 1 });
    expect(compareWindows(items, dateOf, NOW)).toEqual({ current: 6, previous: 1 });
  });

  it('turns a shorter period into its own percentage', () => {
    const totals = compareWindows([ago(1), ago(2), ago(3), ago(8)], dateOf, NOW, undefined, 7);
    expect(percentChange(totals)).toBe(200);
  });
});

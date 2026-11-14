import { describe, expect, it } from 'vitest';
import { readImport } from './importProducts';
import { mapProduct } from './mappers';
import type { Product } from './types';
import { isBigChange, isValidRate, needsRepricing, rateAge, repricedFields, usdOffer, usdPrice, usdText, usesDollars } from './usdPricing';

// The same numbers as test/usd_pricing_test.dart: the panel and the app must agree.

const usd = (extra: Record<string, unknown> = {}): Product =>
  mapProduct('p1', { name: 'Laptop', companyId: 'c1', price: 750000, priceUsd: 250, usdRateApplied: 3000, ...extra });

describe('the sums', () => {
  it('a price rounds UP to the next 500 pounds', () => {
    expect(usdPrice(99, 3170)).toBe(314000);
    expect(usdPrice(250, 3170)).toBe(792500);
    expect(usdPrice(12.5, 3170)).toBe(40000);
    expect(usdPrice(250, 3000)).toBe(750000);
  });

  it('an exact sum is not pushed up by floating point', () => {
    expect(usdPrice(1.1, 5000)).toBe(5500);
    expect(usdOffer(1.1, 5000)).toBe(5500);
  });

  it('an offer rounds DOWN, never below 500', () => {
    expect(usdOffer(89, 3170)).toBe(282000);
    expect(usdOffer(0.01, 3000)).toBe(500);
  });

  it('rate checks, big jumps and the age of a rate', () => {
    expect(isValidRate(3000)).toBe(true);
    expect(isValidRate(0)).toBe(false);
    expect(isValidRate(2_000_000)).toBe(false);
    expect(isBigChange(3000, 3500)).toBe(false);
    expect(isBigChange(3000, 30000)).toBe(true);
    expect(isBigChange(null, 30000)).toBe(false);
    const now = new Date(2026, 10, 5, 12).getTime();
    expect(rateAge(new Date(now - 23 * 3600_000), now)).toBe('fresh');
    expect(rateAge(new Date(now - 24 * 3600_000), now)).toBe('due');
    expect(rateAge(new Date(now - 48 * 3600_000), now)).toBe('stale');
    expect(rateAge(null, now)).toBe('stale');
    expect(usdText(3250.75)).toBe('3,250.75');
    expect(usdText(12.5)).toBe('12.5');
  });
});

describe('repricing a product', () => {
  it('only dollar products that do not use the rate yet', () => {
    expect(needsRepricing(usd(), 3000)).toBe(false);
    expect(needsRepricing(usd(), 3200)).toBe(true);
    expect(needsRepricing(mapProduct('x', { price: 100 }), 3200)).toBe(false);
  });

  it('the price, a dollar offer and a dollar installation price follow the rate', () => {
    const fields = repricedFields(
      usd({ offerPriceUsd: 229, offerPrice: 687000, isInstallationAvailable: true, installationPriceUsd: 15, installationPrice: 45000 }),
      3200,
    );
    expect(fields).toMatchObject({ price: 800000, usdRateApplied: 3200, offerPrice: 732500, installationPrice: 48000 });
  });

  it('an offer made in pounds keeps its share of the price', () => {
    expect(repricedFields(usd({ offerPrice: 600000 }), 3200).offerPrice).toBe(640000);
  });

  it('an offer too close to the price ends instead of blocking the rewrite', () => {
    const fields = repricedFields(usd({ price: 1000, priceUsd: 0.2, offerPriceUsd: 0.19, offerPrice: 500 }), 2500);
    expect(fields).toMatchObject({ price: 500, offerPrice: null, offerPriceUsd: null });
  });

  it('a dollar offer whose pounds were taken off is dropped', () => {
    expect(repricedFields(usd({ offerPriceUsd: 200 }), 3200).offerPriceUsd).toBeNull();
  });
});

describe('importing rows priced in dollars', () => {
  const choices = [{ id: 'cat1', label: 'حواسيب › لابتوبات' }] as never[];
  const head = 'الاسم,التصنيف,السعر,تركيب,سعر التركيب,السعر بالدولار';

  it('works the pounds out from the rate, the installation price in dollars too', () => {
    const { rows } = readImport(`${head}\nلابتوب,لابتوبات,,نعم,15,250`, choices, 3000);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].draft).toMatchObject({ price: 750000, priceUsd: 250, installationPrice: 45000, installationPriceUsd: 15, usdRateApplied: 3000 });
  });

  it('needs the company rate, and only one of the two prices', () => {
    expect(readImport(`${head}\nلابتوب,لابتوبات,,لا,,250`, choices, null).rows[0].errors.length).toBe(1);
    expect(readImport(`${head}\nلابتوب,لابتوبات,1000,لا,,250`, choices, 3000).rows[0].errors.length).toBe(1);
  });

  it('a row in pounds stores no dollars', () => {
    const { rows } = readImport(`${head}\nلابتوب,لابتوبات,1000,لا,,`, choices, 3000);
    expect(rows[0].draft).toMatchObject({ price: 1000, priceUsd: null, usdRateApplied: null });
  });
});

describe('who sees the dollar-rate card', () => {
  const usdProduct = { priceUsd: 10 } as Product;
  const poundProduct = { priceUsd: null } as Product;

  it('is hidden for a company that never chose dollar pricing', () => {
    expect(usesDollars({ usdRate: null }, [])).toBe(false);
    expect(usesDollars({ usdRate: null }, [poundProduct, poundProduct])).toBe(false);
  });

  it('shows once the company has a rate or a product priced in dollars', () => {
    expect(usesDollars({ usdRate: 2500 }, [])).toBe(true);
    expect(usesDollars({ usdRate: 2500 }, [poundProduct])).toBe(true);
    expect(usesDollars({ usdRate: null }, [poundProduct, usdProduct])).toBe(true);
  });
});

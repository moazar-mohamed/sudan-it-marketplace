import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Company, Product } from './types';

// Dollar pricing. A company may type a product's prices in US dollars; the
// Sudanese-pound prices customers see (and orders are checked against) are
// worked out from the company's own dollar rate (companies/{id}.usdRate) and
// stored on the product, so everything that reads `price` keeps working.
//
// Keep the sums in step with lib/features/products/domain/usd_pricing.dart:
// the panel and the app must give the same pounds for the same dollars.

/**
 * Whether a company sells in dollars: it has set a rate, or already has a
 * product priced in dollars. Only then does Today show the dollar-rate card;
 * a company that never chose dollar pricing never sees it. It starts by
 * picking "in dollars" on a product, which asks for the rate right there.
 */
export const usesDollars = (company: Pick<Company, 'usdRate'>, products: readonly Product[]): boolean =>
  company.usdRate !== null || products.some((p) => p.priceUsd !== null);

/** Pound prices are rounded to this step. */
export const USD_STEP = 500;

/** A new rate further than this (a share of the old one) asks first, to catch 30000 for 3000. */
export const BIG_CHANGE = 0.2;

export const MIN_RATE = 1;
export const MAX_RATE = 1_000_000;

const HOUR = 3_600_000;
export const DUE_AFTER_MS = 24 * HOUR;
export const STALE_AFTER_MS = 48 * HOUR;

// Dollars times the rate is not always exact (1.1 x 5000 is 5500.000000000001),
// so a sum within this of a step counts as that step.
const SLACK = 1e-6;

/** The price in pounds: rounded up to the step, so the company never sells below what it typed. */
export const usdPrice = (usd: number, rate: number): number => Math.ceil(usd * rate / USD_STEP - SLACK) * USD_STEP;

/**
 * An offer in pounds: rounded down to the step (one step at least). With the
 * price rounded up, an offer below the price in dollars stays below it in
 * pounds, as the rules require.
 */
export const usdOffer = (usd: number, rate: number): number => Math.max(1, Math.floor(usd * rate / USD_STEP + SLACK)) * USD_STEP;

export const isValidRate = (rate: number | null | undefined): rate is number =>
  typeof rate === 'number' && Number.isFinite(rate) && rate >= MIN_RATE && rate <= MAX_RATE;

export const isBigChange = (oldRate: number | null, newRate: number): boolean =>
  oldRate !== null && oldRate > 0 && Math.abs(newRate - oldRate) / oldRate > BIG_CHANGE;

export type RateAge = 'fresh' | 'due' | 'stale';

export function rateAge(updatedAt: Date | null, now = Date.now()): RateAge {
  if (!updatedAt) return 'stale';
  const age = now - updatedAt.getTime();
  return age >= STALE_AFTER_MS ? 'stale' : age >= DUE_AFTER_MS ? 'due' : 'fresh';
}

/** A dollar amount as the company typed it: separators and at most two decimals (250, 12.5, 3,250.75). */
export const usdText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : value.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Whether [p] is priced in dollars and its pounds were not worked out from [rate]. */
export const needsRepricing = (p: Product, rate: number): boolean => p.priceUsd !== null && p.usdRateApplied !== rate;

/**
 * The fields that bring [p] to [rate]: its pounds worked out again and the rate
 * they use. An offer made in pounds keeps its share of the price; a dollar
 * offer whose pounds were taken off (Platform Admin ended it) is dropped; an
 * offer too close to the price to stay below it once rounded ends.
 */
export function repricedFields(p: Product, rate: number): Record<string, unknown> {
  const usd = p.priceUsd as number;
  const price = usdPrice(usd, rate);
  const fields: Record<string, unknown> = { price, usdRateApplied: rate };
  if (p.offerPrice === null) {
    if (p.offerPriceUsd !== null) fields.offerPriceUsd = null;
  } else {
    const offerUsd =
      p.offerPriceUsd !== null && p.offerPriceUsd < usd
        ? p.offerPriceUsd
        : usd * (p.price !== null && p.price > 0 ? p.offerPrice / p.price : 1);
    const offer = usdOffer(offerUsd, rate);
    if (offer < price) fields.offerPrice = offer;
    else Object.assign(fields, { offerPrice: null, offerEndsAt: null, offerBadge: null, offerPriceUsd: null });
  }
  if (p.isInstallationAvailable && p.installationPriceUsd !== null) fields.installationPrice = usdPrice(p.installationPriceUsd, rate);
  return fields;
}

/** product id to the fields that bring it to [rate], for every dollar product that needs it. */
export const repricing = (products: Product[], rate: number): Map<string, Record<string, unknown>> =>
  new Map(products.filter((p) => needsRepricing(p, rate)).map((p) => [p.id, repricedFields(p, rate)]));

/** Writes per batch, under Firestore's 500 with room to spare. */
const BATCH = 450;

/**
 * Sets the company's dollar rate (confirming the one it has when it is the
 * same) and writes the pounds of its dollar products worked out from it. The
 * rate goes in the first batch with the first products, so they never disagree;
 * a long catalogue takes more batches (and a cut-short rewrite is finished by
 * finishRepricing the next time the panel opens).
 */
export async function saveUsdRate(companyId: string, rate: number, products: Product[]): Promise<number> {
  const entries = [...repricing(products, rate)];
  let batch = writeBatch(db);
  batch.update(doc(db, 'companies', companyId), { usdRate: rate, usdRateUpdatedAt: serverTimestamp() });
  let inBatch = 1;
  for (const [id, fields] of entries) {
    if (inBatch === BATCH) {
      await batch.commit();
      batch = writeBatch(db);
      inBatch = 0;
    }
    batch.update(doc(db, 'products', id), { ...fields, updatedAt: serverTimestamp() });
    inBatch++;
  }
  await batch.commit();
  return entries.length;
}

/** Brings to [rate] the dollar products a cut-short rewrite missed. Never throws. */
export async function finishRepricing(rate: number, products: Product[]): Promise<void> {
  const entries = [...repricing(products, rate)];
  try {
    for (let start = 0; start < entries.length; start += BATCH) {
      const batch = writeBatch(db);
      for (const [id, fields] of entries.slice(start, start + BATCH)) {
        batch.update(doc(db, 'products', id), { ...fields, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }
  } catch {
    // Tried again the next time the panel opens.
  }
}

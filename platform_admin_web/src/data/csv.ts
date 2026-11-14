import { displayPhone } from './phone';
import type { Company, Customer, Product, Review } from './types';

/*
 * CSV for the lists the admin works from. Plain text built in the browser from
 * the documents already on screen; nothing is sent anywhere.
 */

/**
 * One CSV cell. Quotes are doubled and the cell is wrapped when it needs it;
 * text that a spreadsheet would run as a formula (starts with = + - @ or a
 * control character) gets a leading apostrophe so it stays text. Numbers are
 * written as they are.
 */
export function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A header and rows as CSV text: UTF-8 with a BOM so Excel reads Arabic, CRLF line ends. */
export function toCsv(header: readonly string[], rows: readonly (string | number | boolean | null)[][]): string {
  const lines = [header.join(','), ...rows.map((row) => row.map(csvCell).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const iso = (d: Date | null) => (d ? d.toISOString() : '');

export const companiesToCsv = (companies: readonly Company[]): string =>
  toCsv(
    ['company_id', 'name', 'status', 'city', 'address', 'phone', 'email', 'rating', 'reviews', 'created_at'],
    companies.map((c) => [
      c.id,
      c.name,
      c.status,
      c.city,
      c.address,
      c.phone ? displayPhone(c.phone) : '',
      c.email,
      c.rating,
      c.reviewCount,
      iso(c.createdAt),
    ]),
  );

export const customersToCsv = (customers: readonly Customer[]): string =>
  toCsv(
    ['customer_id', 'name', 'email', 'phone', 'active', 'created_at'],
    customers.map((c) => [c.id, c.fullName, c.email, c.phone ? displayPhone(c.phone) : '', c.isActive, iso(c.createdAt)]),
  );

export const reviewsToCsv = (reviews: readonly Review[]): string =>
  toCsv(
    ['review_id', 'created_at', 'customer', 'company', 'rated', 'stars', 'comment', 'reply', 'hidden'],
    reviews.map((r) => [
      r.id,
      iso(r.createdAt),
      r.customerName,
      r.companyName,
      r.targetName,
      r.rating,
      r.comment,
      r.reply,
      r.hidden,
    ]),
  );

export const productsToCsv = (products: readonly Product[]): string =>
  toCsv(
    [
      'product_id', 'name', 'company', 'category_id', 'price', 'currency', 'stock', 'in_stock',
      'delivery', 'installation', 'installation_price', 'offer_price', 'offer_ends_at', 'hidden', 'hidden_reason', 'created_at',
    ],
    products.map((p) => [
      p.id,
      p.name,
      p.companyName,
      p.categoryId ?? '',
      p.price,
      p.currency,
      p.stockCount,
      p.inStock,
      p.isDeliveryAvailable,
      p.isInstallationAvailable,
      p.installationPrice,
      p.offerPrice,
      iso(p.offerEndsAt),
      p.hidden,
      p.hiddenReason,
      iso(p.createdAt),
    ]),
  );

/** Hands the text to the browser as a file download. */
export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** `name-2026-10-03.csv`, dated by the given moment. */
export const csvFilename = (name: string, at: number): string => `${name}-${new Date(at).toISOString().slice(0, 10)}.csv`;

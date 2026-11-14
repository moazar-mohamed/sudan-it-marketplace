import { describe, expect, it } from 'vitest';
import { attentionCounts, sumCounts } from './attention';
import { companiesToCsv, csvCell, csvFilename, customersToCsv, reviewsToCsv, toCsv } from './csv';
import { failed, makeSnapshot, ok } from './dashboardTestkit';
import { mapCompany, mapCustomer, mapOrder, mapReview, mapServiceRequest } from './mappers';
import { isStalledCompany } from './stats';

const NOW = Date.UTC(2026, 9, 15, 10);
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000);
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

describe('companies with no products', () => {
  const company = (extra: Record<string, unknown>) => mapCompany('c', { name: 'Nile Co', createdAt: daysAgo(10), ...extra });

  it('flags an active company past its grace period that lists nothing', () => {
    expect(isStalledCompany(company({ status: 'active' }), false, NOW)).toBe(true);
    expect(isStalledCompany(company({}), false, NOW)).toBe(true); // no stored status counts as active
  });

  it('does not flag a company with products, a new one, or one that is not active', () => {
    expect(isStalledCompany(company({}), true, NOW)).toBe(false);
    expect(isStalledCompany(company({ createdAt: daysAgo(2) }), false, NOW)).toBe(false);
    expect(isStalledCompany(company({ status: 'inactive' }), false, NOW)).toBe(false);
  });

  it('treats a company with no creation date as old enough', () => {
    expect(isStalledCompany(company({ createdAt: undefined }), false, NOW)).toBe(true);
  });
});

describe('attention counts (shared by the dashboard and the sidebar)', () => {
  it('counts every rule over one snapshot', () => {
    const snapshot = makeSnapshot({
      at: NOW,
      openOrders: ok([
        mapOrder('a', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hoursAgo(30) }),
        mapOrder('b', { orderStatus: 'processing', paymentStatus: 'confirmed', createdAt: daysAgo(6) }),
        mapOrder('c', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hoursAgo(2) }),
      ]),
      pendingRequests: ok([mapServiceRequest('r', { status: 'pending', createdAt: hoursAgo(60) })]),
      lowReviews: ok([mapReview('v', { stars: 1, createdAt: daysAgo(1) })]),
      emptyCompanies: ok([mapCompany('c1', { createdAt: daysAgo(10) }), mapCompany('c2', { createdAt: daysAgo(1) })]),
    });
    expect(attentionCounts(snapshot)).toEqual({ unverified: 1, stuck: 1, staleRequests: 1, lowReviews: 1, noProducts: 1 });
  });

  it('gives null for a source that could not be read, never 0', () => {
    const counts = attentionCounts(makeSnapshot({ at: NOW, openOrders: failed, lowReviews: failed }));
    expect(counts).toMatchObject({ unverified: null, stuck: null, lowReviews: null, staleRequests: 0, noProducts: 0 });
  });

  it('sums what is known and gives null when nothing is', () => {
    expect(sumCounts(2, null, 3)).toBe(5);
    expect(sumCounts(null, null)).toBeNull();
    expect(sumCounts(0, 0)).toBe(0);
  });
});

describe('CSV exports', () => {
  it('builds a header and rows with a BOM and CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('﻿a,b\r\n1,"x,y"\r\n');
  });

  it('neutralises formulas and writes booleans as true / false', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell(true)).toBe('true');
    expect(csvCell(false)).toBe('false');
  });

  it('exports companies', () => {
    const csv = companiesToCsv([
      mapCompany('c1', { name: 'Nile, Co', status: 'inactive', city: 'Khartoum', rating: 4.5, reviewCount: 2, createdAt: new Date('2026-10-01T00:00:00Z') }),
    ]);
    const [header, row] = csv.slice(1).split('\r\n');
    expect(header).toBe('company_id,name,status,city,address,phone,email,rating,reviews,created_at');
    expect(row).toBe('c1,"Nile, Co",inactive,Khartoum,,,,4.5,2,2026-10-01T00:00:00.000Z');
  });

  it('exports customers with their access state', () => {
    const csv = customersToCsv([mapCustomer('u1', { fullName: 'Sara', email: 's@x.test', isActive: false })]);
    expect(csv.slice(1).split('\r\n')[1]).toBe('u1,Sara,s@x.test,,false,');
  });

  it('exports reviews, hidden ones included and marked', () => {
    const csv = reviewsToCsv([mapReview('r1', { authorName: 'Omar', companyName: 'Nile Co', targetName: 'Router', stars: 2, comment: 'late', hidden: true })]);
    expect(csv.slice(1).split('\r\n')[1]).toBe('r1,,Omar,Nile Co,Router,2,late,,true');
  });

  it('exports nothing but the header for an empty list', () => {
    expect(companiesToCsv([]).split('\r\n')).toHaveLength(2);
  });

  it('dates the file name', () => {
    expect(csvFilename('companies', Date.UTC(2026, 9, 3, 12))).toBe('companies-2026-10-03.csv');
  });
});

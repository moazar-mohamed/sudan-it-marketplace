import { describe, expect, it } from 'vitest';
import { productsToCsv } from './csv';
import { mapProduct } from './mappers';

const lines = (csv: string) => csv.slice(1).split(String.fromCharCode(13, 10)).filter((l) => l !== '');

describe('the products file', () => {
  it('has one row per product with its price, stock, offer and whether it is hidden', () => {
    const csv = productsToCsv([
      mapProduct('p1', {
        companyId: 'c1',
        companyName: 'Nile Co',
        name: 'Router, dual band',
        price: 120,
        currency: 'USD',
        stockCount: 4,
        inStock: true,
        isDeliveryAvailable: true,
        isInstallationAvailable: false,
        hidden: true,
        hiddenReason: 'Wrong photo',
        categoryId: 'k1',
      }),
    ]);
    const [header, row] = lines(csv);
    expect(csv.startsWith('﻿product_id,name,company')).toBe(true);
    expect(header.split(',')).toHaveLength(16);
    expect(row.startsWith('p1,"Router, dual band",Nile Co,k1,120,USD,4,true,true,false,')).toBe(true);
    expect(row).toContain(',true,Wrong photo,');
  });

  it('leaves the price empty (not 0) when the company gave none', () => {
    const [, row] = lines(productsToCsv([mapProduct('p2', { name: 'Quote only' })]));
    expect(row.split(',')[4]).toBe('');
  });

  it('writes only the header for no products', () => {
    expect(lines(productsToCsv([]))).toHaveLength(1);
  });
});

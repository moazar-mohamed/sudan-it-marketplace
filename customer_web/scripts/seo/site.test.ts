import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module without types
import { renderSite } from './site.mjs';

const NOW = new Date('2026-11-05T10:00:00Z');
const SITE = 'https://shop.example.com';

const categories = [
  { id: 'c_comp', nameAr: 'حواسيب', isActive: true, parentId: '' },
  { id: 'c_lap', nameAr: 'لابتوبات', isActive: true, parentId: 'c_comp' },
  { id: 'c_off', nameAr: 'مخفي', isActive: false, parentId: '' },
  { id: 'c_empty', nameAr: 'فارغ', isActive: true, parentId: '' },
];
const companies = [
  { id: 'co1', name: 'النيل <للحلول>', status: 'active', description: 'شركة "تقنية"', logoUrl: 'https://img.test/logo.png', phone: '+249912345678', address: 'سري' },
  { id: 'co2', name: 'موقوفة', status: 'inactive' },
];
const product = (id: string, over: Record<string, unknown> = {}) => ({
  id, companyId: 'co1', companyName: 'النيل', categoryId: 'c_lap', name: `منتج ${id}`, brand: 'HP', price: 1000, currency: 'SDG',
  stockCount: 3, status: 'published', imageUrl: `https://img.test/${id}.jpg`, createdAt: '2026-11-01T00:00:00Z', ...over,
});

const render = (products: object[]) => renderSite({ products, companies, categories }, { siteUrl: SITE, now: NOW });

describe('the public catalog pages', () => {
  it('shows only what a customer could buy', () => {
    const { files, counts } = render([
      product('ok'),
      product('draft', { status: 'draft' }),
      product('archived', { status: 'archived' }),
      product('hidden', { hidden: true }),
      product('nostock', { stockCount: 0 }),
      product('badcompany', { companyId: 'co2' }),
      product('badcategory', { categoryId: 'c_off' }),
    ]);
    expect(counts.products).toBe(1);
    expect([...files.keys()].filter((k) => k.startsWith('catalog/product/'))).toEqual(['catalog/product/ok/index.html']);
  });

  it('writes a product page with its price, a link to buy, and structured data', () => {
    const { files } = render([product('p1', { description: 'سطر 1\nسطر 2', specifications: { 'المعالج': 'i5' }, specificationsOrder: ['المعالج'] })]);
    const html = files.get('catalog/product/p1/index.html') as string;
    expect(html).toContain('<title>منتج p1 | سوق السودان للتقنية</title>');
    expect(html).toContain(`<link rel="canonical" href="${SITE}/catalog/product/p1/">`);
    expect(html).toContain('1,000 SDG');
    expect(html).toContain('href="/product/p1"');
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"availability":"https://schema.org/InStock"');
    expect(html).toContain('<th>المعالج</th><td>i5</td>');
    expect(html).toContain('سطر 1<br>سطر 2');
    expect(html).toContain('property="og:image" content="https://img.test/p1.jpg"');
  });

  it('uses an offer only while it runs', () => {
    const live = render([product('a', { offerPrice: 800, offerEndsAt: '2026-12-01T00:00:00Z' })]).files.get('catalog/product/a/index.html') as string;
    expect(live).toContain('800 SDG');
    expect(live).toContain('<s><bdi dir="ltr">1,000</bdi></s>');
    const over = render([product('b', { offerPrice: 800, offerEndsAt: '2026-11-01T00:00:00Z' })]).files.get('catalog/product/b/index.html') as string;
    expect(over).not.toContain('<s>');
    expect(over).toContain('1,000 SDG');
  });

  it('says "price on request" when there is no price', () => {
    const html = render([product('np', { price: null })]).files.get('catalog/product/np/index.html') as string;
    expect(html).toContain('السعر عند التواصل');
    expect(html).not.toContain('"offers"');
  });

  it('never prints contact details, and escapes what companies wrote', () => {
    const all = [...render([product('p1')]).files.values()].join('\n');
    expect(all).not.toContain('+249912345678');
    expect(all).not.toContain('سري');
    const company = render([product('p1')]).files.get('catalog/company/co1/index.html') as string;
    expect(company).toContain('النيل &lt;للحلول&gt;');
    expect(company).toContain('شركة &quot;تقنية&quot;');
    expect(company).not.toContain('<للحلول>');
  });

  it('lists categories that have products, parents counting their children', () => {
    const { files } = render([product('p1')]);
    const keys = [...files.keys()];
    expect(keys).toContain('catalog/category/c_comp/index.html');
    expect(keys).toContain('catalog/category/c_lap/index.html');
    expect(keys).not.toContain('catalog/category/c_off/index.html');
    expect(keys).not.toContain('catalog/category/c_empty/index.html');
    expect(files.get('catalog/category/c_lap/index.html')).toContain('حواسيب</a> › <span>لابتوبات</span>');
  });

  it('lists every page in the sitemap and points robots.txt at it', () => {
    const { files } = render([product('p1'), product('p2')]);
    const sitemap = files.get('sitemap.xml') as string;
    for (const path of ['/catalog/', '/catalog/product/p1/', '/catalog/product/p2/', '/catalog/company/co1/', '/catalog/category/c_lap/']) {
      expect(sitemap).toContain(`<loc>${SITE}${path}</loc>`);
    }
    expect(files.get('robots.txt')).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it('still makes a home page when nothing is on sale', () => {
    const { files, counts } = render([]);
    expect(counts.products).toBe(0);
    expect(files.get('catalog/index.html')).toContain('لا منتجات معروضة الآن');
  });
});

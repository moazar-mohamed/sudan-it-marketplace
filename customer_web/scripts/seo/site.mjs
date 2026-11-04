// Builds the public pages of the marketplace (home, categories, products, companies),
// the sitemap and robots.txt, as plain HTML strings. No I/O here: generate.mjs reads the
// data and writes the files, the tests call renderSite() with a small made-up catalog.
//
// What is public: names, prices, pictures, descriptions and specifications of products on
// sale, and a company's name, logo, description and service cities. Never contact details,
// addresses, locations or payment accounts.

export const SITE_NAME = 'سوق السودان للتقنية';
const TAGLINE = 'منتجات وشركات وفنيون في مدينتك';
const MAX_PRODUCTS_PER_PAGE = 120;
const HOME_PRODUCTS = 24;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const money = (n) => Math.round(n).toLocaleString('en-US');
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const date = (v) => (v instanceof Date ? v : typeof v === 'string' && v ? new Date(v) : null);
const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

const encodeId = (id) => encodeURIComponent(id);
const productPath = (id) => `/catalog/product/${encodeId(id)}/`;
const companyPath = (id) => `/catalog/company/${encodeId(id)}/`;
const categoryPath = (id) => `/catalog/category/${encodeId(id)}/`;

// ── What may be shown ────────────────────────────────────────────────────────

const companyIsActive = (c) => !['pending', 'rejected', 'inactive'].includes(c.status);

function categoryName(c) {
  return str(c.nameAr) || str(c.name) || str(c.nameEn);
}

/** Active categories under active ancestors only (what customers are shown). */
function buildCategories(raw) {
  const byId = new Map(raw.map((c) => [c.id, c]));
  const pathOf = (id) => {
    const path = [];
    const seen = new Set();
    let cur = byId.get(id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      path.unshift(cur);
      cur = str(cur.parentId) ? byId.get(cur.parentId) : undefined;
    }
    return path;
  };
  const effective = (id) => {
    const path = pathOf(id);
    return path.length > 0 && path.every((c) => c.isActive === true && c.deletionPending !== true);
  };
  const compare = (a, b) => {
    const sa = num(a.sortOrder);
    const sb = num(b.sortOrder);
    if (sa !== null && sb !== null && sa !== sb) return sa - sb;
    if (sa !== null && sb === null) return -1;
    if (sa === null && sb !== null) return 1;
    return categoryName(a).localeCompare(categoryName(b), 'ar');
  };
  return { byId, pathOf, effective, compare };
}

/** The offer price that is valid at [now], else null. */
function activeOffer(p, now) {
  const price = num(p.price);
  const offer = num(p.offerPrice);
  if (price === null || offer === null || offer <= 0 || offer >= price) return null;
  const ends = date(p.offerEndsAt);
  return ends === null || ends.getTime() > now.getTime() ? offer : null;
}

/** Products a visitor may see, with what the pages need already worked out. */
function visibleProducts(data, cats, companies, now) {
  const out = [];
  for (const p of data.products) {
    if (p.hidden === true || p.status === 'draft' || p.status === 'archived') continue;
    if (!(num(p.stockCount) > 0)) continue;
    const companyId = str(p.companyId);
    if (companyId !== '' && !companies.has(companyId)) continue;
    const categoryId = str(p.categoryId) || null;
    if (categoryId !== null && !cats.effective(categoryId)) continue;
    if (!str(p.name)) continue;
    const imageUrl = str(p.imageUrl);
    const urls = Array.isArray(p.imageUrls) ? p.imageUrls.filter((u) => typeof u === 'string' && u !== '').slice(0, 5) : [];
    const order = Array.isArray(p.specificationsOrder) ? p.specificationsOrder : [];
    const raw = p.specifications && typeof p.specifications === 'object' ? p.specifications : {};
    const specs = [];
    for (const k of order) if (k in raw) specs.push([k, String(raw[k])]);
    for (const k of Object.keys(raw)) if (!order.includes(k)) specs.push([k, String(raw[k])]);
    out.push({
      id: p.id,
      name: str(p.name),
      brand: str(p.brand),
      description: str(p.description),
      companyId,
      companyName: companies.get(companyId)?.name ?? str(p.companyName),
      categoryId,
      images: urls.length > 0 ? urls : imageUrl ? [imageUrl] : [],
      price: num(p.price),
      offer: activeOffer(p, now),
      currency: str(p.currency) || 'SDG',
      delivery: p.isDeliveryAvailable !== false,
      installation: p.isInstallationAvailable === true,
      specs,
      createdAt: date(p.createdAt),
    });
  }
  return out.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

// ── HTML ─────────────────────────────────────────────────────────────────────

const CSS = `
:root{--bg:#f5f7fa;--card:#fff;--ink:#0f1b2d;--muted:#5b6778;--line:#e3e8ef;--brand:#1565c0;--brand-ink:#0f4c9a;--tint:#e7f0fb;--ok:#14693a;--bad:#a3201f}
@media (prefers-color-scheme:dark){:root{--bg:#0e141c;--card:#161e29;--ink:#e7ecf3;--muted:#97a3b4;--line:#263241;--brand:#2f78d0;--brand-ink:#8dbbf2;--tint:#17304d;--ok:#4cc38a;--bad:#f27a78}}
*{box-sizing:border-box}body{margin:0;font-family:Cairo,system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:var(--bg);color:var(--ink);line-height:1.7}
a{color:inherit;text-decoration:none}a:hover{color:var(--brand-ink)}
header.top{background:var(--card);border-bottom:1px solid var(--line)}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px}
.bar{display:flex;align-items:center;gap:12px;min-height:64px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px}.brand img{width:36px;height:36px;border-radius:9px}
.bar nav{display:flex;gap:16px;margin-inline-start:auto;font-weight:600;color:var(--muted)}
.btn{display:inline-block;background:var(--brand);color:#fff;font-weight:700;padding:10px 18px;border-radius:12px}.btn:hover{color:#fff;opacity:.92}
main{padding:20px 0 48px}
.crumbs{font-size:13px;color:var(--muted);margin:4px 0 14px}.crumbs a:hover{text-decoration:underline}
h1{font-size:26px;line-height:1.35;margin:0 0 8px}h2{font-size:19px;margin:28px 0 12px}
.lead{color:var(--muted);margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;list-style:none;margin:0;padding:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;height:100%}
.card .img{aspect-ratio:4/3;background:var(--tint);display:grid;place-items:center;color:var(--muted);font-size:13px}.card .img img{width:100%;height:100%;object-fit:cover;display:block}
.card .body{padding:12px 14px;display:flex;flex-direction:column;gap:4px}.card .name{font-weight:700}.card .meta{font-size:13px;color:var(--muted)}
.price{font-weight:800;color:var(--brand-ink)}.price s{font-weight:500;color:var(--muted);margin-inline-start:6px}
.chips{display:flex;gap:8px;flex-wrap:wrap;list-style:none;margin:0;padding:0}.chips a{display:block;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-weight:600}
.product{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:start}.product.noimg{grid-template-columns:minmax(0,640px)}
@media(max-width:760px){.product{grid-template-columns:1fr}}
.gallery img{width:100%;border-radius:18px;background:var(--tint);display:block}.gallery .thumbs{display:flex;gap:8px;margin-top:8px}.gallery .thumbs img{width:64px;height:64px;object-fit:cover;border-radius:10px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}
.big{font-size:26px;font-weight:800;color:var(--brand-ink)}.big s{font-size:16px;font-weight:500;color:var(--muted);margin-inline-start:8px}
.ok{color:var(--ok);font-weight:700}.bad{color:var(--bad);font-weight:700}
table{width:100%;border-collapse:collapse}th,td{text-align:start;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{width:34%;color:var(--muted);font-weight:600}
.logo{width:72px;height:72px;border-radius:16px;object-fit:cover;background:var(--tint)}
.note{font-size:13px;color:var(--muted);margin-top:14px}
footer{border-top:1px solid var(--line);padding:20px 0;color:var(--muted);font-size:13px;text-align:center}
`.replace(/\n/g, '');

function layout({ siteUrl, path, title, description, image, type = 'website', body, ld = [] }) {
  const url = `${siteUrl}${path}`;
  const pageTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const img = image || `${siteUrl}/og-logo.png`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(clip(description, 200))}">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" type="image/png" href="/favicon-mark.png">
<meta name="theme-color" content="#1565C0">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:locale" content="ar_AR">
<meta property="og:type" content="${esc(type)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(clip(description, 200))}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<style>${CSS}</style>
${ld.map(jsonLd).join('\n')}
</head>
<body>
<header class="top"><div class="wrap bar">
<a class="brand" href="/catalog/"><img src="/favicon-mark.png" alt="" width="36" height="36"><span>${esc(SITE_NAME)}</span></a>
<nav><a href="/catalog/">الرئيسية</a></nav>
<a class="btn" href="/">تسجيل الدخول</a>
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer><div class="wrap">${esc(SITE_NAME)} · ${esc(TAGLINE)}<br>للشراء وطلب الخدمات سجّل الدخول أو أنشئ حسابًا. الأسعار والمخزون كما كانت وقت نشر هذه الصفحة وقد تتغيّر.</div></footer>
</body>
</html>
`;
}

const crumbs = (items) =>
  `<nav class="crumbs" aria-label="مسار التصفح">${items.map((i) => (i.to ? `<a href="${esc(i.to)}">${esc(i.label)}</a>` : `<span>${esc(i.label)}</span>`)).join(' › ')}</nav>`;

function priceHtml(p, big = false) {
  if (p.price === null) return `<span class="${big ? 'big' : 'price'}">السعر عند التواصل</span>`;
  const cur = esc(p.currency);
  // Each number sits in its own left-to-right island, so the right-to-left page cannot reorder it.
  if (p.offer !== null) return `<span class="${big ? 'big' : 'price'}"><bdi dir="ltr">${money(p.offer)} ${cur}</bdi><s><bdi dir="ltr">${money(p.price)}</bdi></s></span>`;
  return `<span class="${big ? 'big' : 'price'}"><bdi dir="ltr">${money(p.price)} ${cur}</bdi></span>`;
}

function cardHtml(p) {
  const image = p.images[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy">` : '<span>بلا صورة</span>';
  return `<li><a class="card" href="${productPath(p.id)}"><div class="img">${image}</div><div class="body"><span class="name">${esc(p.name)}</span><span class="meta">${esc([p.brand, p.companyName].filter(Boolean).join(' · '))}</span>${priceHtml(p)}</div></a></li>`;
}

const gridHtml = (products) => `<ul class="grid">${products.slice(0, MAX_PRODUCTS_PER_PAGE).map(cardHtml).join('')}</ul>`;

// ── The whole site ───────────────────────────────────────────────────────────

/**
 * @param {{products: object[], companies: object[], categories: object[]}} data Plain documents, each with its `id`.
 * @param {{siteUrl: string, now?: Date}} options
 * @returns {{files: Map<string, string>, counts: {products: number, companies: number, categories: number}}}
 *   `files` maps a path under public/ ('catalog/index.html', 'sitemap.xml'...) to its text.
 */
export function renderSite(data, { siteUrl, now = new Date() }) {
  const base = siteUrl.replace(/\/+$/, '');
  const cats = buildCategories(data.categories);
  const companies = new Map(
    data.companies.filter(companyIsActive).map((c) => [c.id, { id: c.id, name: str(c.name), logo: str(c.logoUrl), description: str(c.description), cityIds: Array.isArray(c.serviceCityIds) ? c.serviceCityIds : [] }]),
  );
  const products = visibleProducts(data, cats, companies, now);
  const files = new Map();
  const urls = [];

  const subtreeIds = (id) => {
    const out = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of data.categories) {
        if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true; }
      }
    }
    return out;
  };
  const productsIn = (id) => {
    const ids = subtreeIds(id);
    return products.filter((p) => p.categoryId !== null && ids.has(p.categoryId));
  };

  // Categories that have something to show.
  const shownCategories = data.categories.filter((c) => cats.effective(c.id) && productsIn(c.id).length > 0).sort(cats.compare);
  const topCategories = shownCategories.filter((c) => !str(c.parentId) || !shownCategories.some((x) => x.id === c.parentId));
  const shownCompanies = [...companies.values()].filter((c) => products.some((p) => p.companyId === c.id));

  const add = (path, html, priority) => {
    files.set(`${path.replace(/^\//, '')}index.html`, html);
    urls.push({ loc: `${base}${path}`, priority });
  };

  // Home
  add('/catalog/', layout({
    siteUrl: base, path: '/catalog/', title: SITE_NAME,
    description: `${SITE_NAME}: ${TAGLINE}. تصفّح الحواسيب والشبكات ومستلزمات التقنية من شركات في السودان.`,
    body: `<h1>${esc(SITE_NAME)}</h1><p class="lead">${esc(TAGLINE)}. تصفّح المنتجات والشركات، ثم سجّل الدخول للشراء.</p>
${topCategories.length ? `<h2>التصنيفات</h2><ul class="chips">${topCategories.map((c) => `<li><a href="${categoryPath(c.id)}">${esc(categoryName(c))}</a></li>`).join('')}</ul>` : ''}
${products.length ? `<h2>أحدث المنتجات</h2>${gridHtml(products.slice(0, HOME_PRODUCTS))}` : '<p class="lead">لا منتجات معروضة الآن.</p>'}
${shownCompanies.length ? `<h2>الشركات</h2><ul class="chips">${shownCompanies.map((c) => `<li><a href="${companyPath(c.id)}">${esc(c.name)}</a></li>`).join('')}</ul>` : ''}`,
    ld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${base}/catalog/`, inLanguage: 'ar' }],
  }), '1.0');

  // Categories
  for (const c of shownCategories) {
    const path = cats.pathOf(c.id);
    const list = productsIn(c.id);
    const children = shownCategories.filter((x) => x.parentId === c.id);
    const trail = [{ label: 'الرئيسية', to: '/catalog/' }, ...path.slice(0, -1).map((a) => ({ label: categoryName(a), to: categoryPath(a.id) })), { label: categoryName(c) }];
    const name = path.map(categoryName).join(' › ');
    add(categoryPath(c.id), layout({
      siteUrl: base, path: categoryPath(c.id), title: name,
      description: str(c.description) || `${categoryName(c)}: ${list.length} منتجًا من شركات في السودان على ${SITE_NAME}.`,
      body: `${crumbs(trail)}<h1>${esc(categoryName(c))}</h1>${str(c.description) ? `<p class="lead">${esc(str(c.description))}</p>` : ''}
${children.length ? `<ul class="chips">${children.map((x) => `<li><a href="${categoryPath(x.id)}">${esc(categoryName(x))}</a></li>`).join('')}</ul>` : ''}
<h2>المنتجات (${list.length})</h2>${gridHtml(list)}`,
      image: list[0]?.images[0],
      ld: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.label, item: `${base}${t.to ?? categoryPath(c.id)}` })) }],
    }), '0.8');
  }

  // Companies
  for (const co of shownCompanies) {
    const list = products.filter((p) => p.companyId === co.id);
    add(companyPath(co.id), layout({
      siteUrl: base, path: companyPath(co.id), title: co.name,
      description: co.description || `${co.name}: ${list.length} منتجًا على ${SITE_NAME}.`,
      body: `${crumbs([{ label: 'الرئيسية', to: '/catalog/' }, { label: co.name }])}
<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">${co.logo ? `<img class="logo" src="${esc(co.logo)}" alt="${esc(co.name)}" width="72" height="72">` : ''}<div><h1 style="margin:0">${esc(co.name)}</h1>${co.description ? `<p class="lead" style="margin:4px 0 0">${esc(co.description)}</p>` : ''}</div></div>
<h2>منتجات ${esc(co.name)} (${list.length})</h2>${gridHtml(list)}
<p class="note"><a class="btn" href="/company/${encodeId(co.id)}">افتح صفحة الشركة بعد تسجيل الدخول</a></p>`,
      image: co.logo || list[0]?.images[0],
      ld: [{ '@context': 'https://schema.org', '@type': 'Organization', name: co.name, url: `${base}${companyPath(co.id)}`, ...(co.logo ? { logo: co.logo } : {}), ...(co.description ? { description: co.description } : {}) }],
    }), '0.6');
  }

  // Products
  for (const p of products) {
    const trailCats = p.categoryId ? cats.pathOf(p.categoryId) : [];
    const trail = [{ label: 'الرئيسية', to: '/catalog/' }, ...trailCats.map((a) => ({ label: categoryName(a), to: categoryPath(a.id) })), { label: p.name }];
    const same = products.filter((x) => x.id !== p.id && x.categoryId === p.categoryId && p.categoryId !== null).slice(0, 6);
    const description = p.description || `${p.name}${p.brand ? ` من ${p.brand}` : ''}${p.companyName ? ` لدى ${p.companyName}` : ''} على ${SITE_NAME}.`;
    const offerPrice = p.offer ?? p.price;
    add(productPath(p.id), layout({
      siteUrl: base, path: productPath(p.id), title: p.name, description, image: p.images[0], type: 'product',
      body: `${crumbs(trail)}
<div class="product${p.images.length ? '' : ' noimg'}">
${p.images.length ? `<div class="gallery">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}">` : ''}${p.images.length > 1 ? `<div class="thumbs">${p.images.slice(1).map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}</div>` : ''}
<div class="panel">
<h1>${esc(p.name)}</h1>
<p class="meta" style="color:var(--muted);margin:0 0 10px">${esc([p.brand, p.companyName && `من ${p.companyName}`].filter(Boolean).join(' · '))}</p>
<p style="margin:0 0 8px">${priceHtml(p, true)}</p>
<p class="ok" style="margin:0 0 12px">متوفر</p>
<p style="margin:0 0 14px">${p.delivery ? 'التوصيل متاح' : 'الاستلام من الشركة فقط'}${p.installation ? ' · التركيب متاح' : ''}</p>
<a class="btn" href="/product/${encodeId(p.id)}">${p.price === null ? 'تواصل بعد تسجيل الدخول' : 'اطلب الآن (بعد تسجيل الدخول)'}</a>
${p.companyId ? `<p class="note">البائع: <a href="${companyPath(p.companyId)}">${esc(p.companyName)}</a></p>` : ''}
</div></div>
${p.description ? `<h2>الوصف</h2><p>${esc(p.description).replace(/\n/g, '<br>')}</p>` : ''}
${p.specs.length ? `<h2>المواصفات</h2><table>${p.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
${same.length ? `<h2>منتجات مشابهة</h2>${gridHtml(same)}` : ''}`,
      ld: [
        {
          '@context': 'https://schema.org', '@type': 'Product', name: p.name,
          ...(p.images.length ? { image: p.images } : {}), ...(p.description ? { description: p.description } : {}),
          ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
          ...(offerPrice !== null ? { offers: { '@type': 'Offer', url: `${base}${productPath(p.id)}`, price: offerPrice, priceCurrency: p.currency, availability: 'https://schema.org/InStock', ...(p.companyName ? { seller: { '@type': 'Organization', name: p.companyName } } : {}) } } : {}),
        },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.label, ...(t.to ? { item: `${base}${t.to}` } : {}) })) },
      ],
    }), '0.7');
  }

  const lastmod = now.toISOString().slice(0, 10);
  files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(u.loc)}</loc><lastmod>${lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`);
  files.set('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);

  return { files, counts: { products: products.length, companies: shownCompanies.length, categories: shownCategories.length } };
}

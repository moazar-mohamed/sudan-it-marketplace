import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localCityText } from '../data/cities';
import { useCatalog } from '../data/DataProvider';
import { categoryEmoji } from '../data/categoryEmoji';
import { categoryName, categorySearchText, salePrice, formatPrice } from '../data/format';
import { matchingCategories, marketplaceSearch } from '../data/marketplaceSearch';
import { addRecentSearch, readRecentSearches } from '../data/recentSearches';
import { normalizeSearchText, suggestCorrection } from '../data/searchRanking';
import { useTheme } from '../theme';
import { Highlighted } from './Bits';
import { Icon, PATHS } from './Icon';
import { t } from '../i18n';

interface Entry {
  key: string;
  group: string;
  title: string;
  hint: string;
  icon: string;
  image?: string;
  /** A colourful shape shown instead of the line icon (categories). */
  glyph?: string;
  run: () => void;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const catalog = useCatalog();
  const { cycle } = useTheme();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = q.trim();

  const entries = useMemo<Entry[]>(() => {
    const go = (path: string) => () => {
      if (typed) addRecentSearch(typed);
      onClose();
      nav(path);
    };
    const searchFor = (text: string) => () => {
      addRecentSearch(text);
      onClose();
      nav(`/search?q=${encodeURIComponent(text)}`);
    };

    const actions: Entry[] = [
      { key: 'a-browse', group: t('أوامر سريعة'), title: t('تصفّح المنتجات والخدمات'), hint: '', icon: PATHS.grid, run: go('/browse') },
      { key: 'a-offers', group: t('أوامر سريعة'), title: t('العروض'), hint: '', icon: PATHS.box, run: go('/browse?offers=1') },
      { key: 'a-service', group: t('أوامر سريعة'), title: t('اطلب فنيًا'), hint: '', icon: PATHS.wrench, run: go('/browse?kind=services') },
      { key: 'a-companies', group: t('أوامر سريعة'), title: t('الشركات'), hint: '', icon: PATHS.building, run: go('/companies') },
      { key: 'a-orders', group: t('أوامر سريعة'), title: t('افتح طلباتي'), hint: '', icon: PATHS.box, run: go('/orders') },
      { key: 'a-chats', group: t('أوامر سريعة'), title: t('افتح المحادثات'), hint: '', icon: PATHS.chat, run: go('/chats') },
      { key: 'a-profile', group: t('أوامر سريعة'), title: t('حسابي'), hint: '', icon: PATHS.user, run: go('/profile') },
      { key: 'a-theme', group: t('أوامر سريعة'), title: t('تبديل المظهر (فاتح / داكن)'), hint: '', icon: PATHS.moon, run: () => { cycle(); onClose(); } },
    ];
    if (!typed) {
      const recent: Entry[] = readRecentSearches().map((text) => ({
        key: `r-${text}`, group: t('عمليات البحث الأخيرة'), title: text, hint: '', icon: PATHS.search, run: searchFor(text),
      }));
      return [...recent, ...actions];
    }

    const results = marketplaceSearch(typed, catalog);
    const categories = matchingCategories(typed, catalog.tree).slice(0, 2);
    const needle = normalizeSearchText(typed);
    const out: Entry[] = [
      { key: 'search', group: t('بحث'), title: t('ابحث عن «{0}»', typed), hint: '', icon: PATHS.search, run: searchFor(typed) },
    ];
    if (results.products.length + results.services.length + results.companies.length + categories.length === 0) {
      const guess = suggestCorrection(typed, catalog.vocabulary);
      if (guess) {
        out.push({ key: 'guess', group: t('بحث'), title: t('هل تقصد «{0}»؟', guess), hint: '', icon: PATHS.search, run: searchFor(guess) });
      }
    }
    for (const c of categories) {
      out.push({ key: `c-${c.id}`, group: t('أقسام'), title: categoryName(c), hint: t('قسم'), icon: PATHS.grid, glyph: categoryEmoji(c.iconName, categorySearchText(c)), run: go(`/category/${c.id}`) });
    }
    for (const p of results.products.slice(0, 3)) {
      const price = salePrice(p);
      out.push({
        key: `p-${p.id}`, group: t('منتجات'), title: p.name,
        hint: price === null ? p.companyName : `${p.companyName} · ${formatPrice(price, p.currency)}`,
        icon: PATHS.box, image: p.imageUrl, run: go(`/product/${p.id}`),
      });
    }
    for (const s of results.services.slice(0, 2)) {
      out.push({ key: `s-${s.id}`, group: t('خدمات'), title: s.name, hint: t('خدمة'), icon: PATHS.wrench, run: go(`/service/${s.id}`) });
    }
    for (const c of results.companies.slice(0, 2)) {
      out.push({ key: `co-${c.id}`, group: t('شركات'), title: c.name, hint: localCityText(c.city, catalog.cities) || t('شركة'), icon: PATHS.building, image: c.logoUrl, run: go(`/company/${c.id}`) });
    }
    return out.concat(actions.filter((a) => normalizeSearchText(a.title).includes(needle)));
  }, [typed, catalog, nav, onClose, cycle]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.item.on')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, entries.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); entries[active]?.run(); }
    else if (e.key === 'Escape') onClose();
  }

  let lastGroup = '';
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={t('بحث')}>
        <div className="palette-input">
          <Icon d={PATHS.search} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('ابحث عن منتجات وخدمات وشركات')}
            aria-label={t('بحث')}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list" ref={listRef}>
          {entries.map((e, i) => {
            const header = e.group !== lastGroup;
            lastGroup = e.group;
            return (
              <div key={e.key}>
                {header && <div className="group-label">{e.group}</div>}
                <button
                  className={`item${i === active ? ' on' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={e.run}
                >
                  <span className="thumb">
                    {e.image ? <img src={e.image} alt="" /> : e.glyph ? <span className="glyph" style={{ fontSize: 22 }} aria-hidden="true">{e.glyph}</span> : <Icon d={e.icon} size={20} />}
                  </span>
                  <span className="grow">
                    <span style={{ display: 'block', fontWeight: 700 }}>
                      {e.key === 'search' ? e.title : <Highlighted text={e.title} query={typed} />}
                    </span>
                    {e.hint && <span className="pmeta">{e.hint}</span>}
                  </span>
                  {i === active && <span className="kbd">↵</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span>{' '}{t('للتنقل')}</span>
          <span><span className="kbd">↵</span>{' '}{t('للفتح')}</span>
        </div>
      </div>
    </div>
  );
}

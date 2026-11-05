import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  hitPath,
  MIN_SEARCH_LENGTH,
  searchRecords,
  SEARCH_KINDS,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from '../data/globalSearch';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';
import { customerLabel, matchesQuery, shortId } from '../utils';
import { Icon, type IconName } from './Icon';
import { NAV_V2 } from './navItemsV2';

/** How long the admin must pause typing before records are searched. */
export const SEARCH_DELAY_MS = 300;

interface Row {
  key: string;
  to: string;
  icon: IconName;
  title: string;
  subtitle?: string;
  /** The redesign names the kind of a record (company, order...) beside it. */
  tag?: string;
}

/** What needs attention, one press away (the redesign's list before anything is typed). */
const QUICK_LINKS: { key: TranslationKey; to: string; icon: IconName }[] = [
  { key: 'search.q.stuck', to: '/orders?attention=stuck', icon: 'orders' },
  { key: 'search.q.reports', to: '/reports', icon: 'flag' },
  { key: 'search.q.noProducts', to: '/companies?attention=noProducts', icon: 'companies' },
  { key: 'search.q.requests', to: '/service-requests?attention=stale', icon: 'serviceRequests' },
  { key: 'search.q.lowReviews', to: '/reviews?attention=low', icon: 'reviews' },
];

const KIND_TITLE: Record<SearchKind, TranslationKey> = {
  company: 'nav.companies',
  customer: 'nav.customers',
  order: 'nav.orders',
  product: 'nav.products',
};

/** A search window over the whole panel: pages at once, records (companies, customers, orders, products) as you type. Opened with Ctrl+K. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PaletteDialog onClose={onClose} />;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const { t, money } = useI18n();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [found, setFound] = useState<{ term: string; results: SearchResults } | null>(null);
  const [searching, setSearching] = useState(false);

  // Remember who had the focus, give it to the box, and give it back on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => before?.focus?.();
  }, []);

  const trimmed = term.trim();
  const wantsRecords = trimmed.length >= MIN_SEARCH_LENGTH;

  // Records are searched once the admin pauses; an older answer never replaces a newer one.
  useEffect(() => {
    if (!wantsRecords) return undefined;
    let current = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchRecords(db, trimmed)
        .then((results) => current && setFound({ term: trimmed, results }))
        .catch(() => {
          // A search that could not even start: every kind shows as unavailable.
          const failed = { ok: false as const };
          if (current) setFound({ term: trimmed, results: { company: failed, customer: failed, order: failed, product: failed } });
        })
        .finally(() => current && setSearching(false));
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [trimmed, wantsRecords]);

  const pages: Row[] = useMemo(() => {
    // The eight sections first, then their parts (shown as "part, in section").
    const all: Row[] = NAV_V2.flatMap((s) => [
      { key: `page:${s.to}`, to: s.to, icon: s.icon, title: t(s.key) },
      ...(s.children ?? [])
        .filter((c) => c.to !== s.to)
        .map((c) => ({ key: `page:${c.to}`, to: c.to, icon: s.icon, title: t(c.key), subtitle: t(s.key) })),
    ]);
    const matched = all.filter((r) => matchesQuery(trimmed, r.title, r.subtitle ?? ''));
    // With nothing typed, only the sections; the parts appear as you type.
    return trimmed ? matched : matched.filter((r) => !r.subtitle);
  }, [trimmed, t]);

  const quick: Row[] = useMemo(
    () => (!trimmed ? QUICK_LINKS.map((q) => ({ key: `quick:${q.to}`, to: q.to, icon: q.icon, title: t(q.key) })) : []),
    [trimmed, t],
  );

  const describe = (hit: SearchHit): Row => {
    switch (hit.kind) {
      case 'company':
        return {
          key: `company:${hit.item.id}`,
          to: hitPath(hit),
          icon: 'companies',
          title: hit.item.name || '—',
          subtitle: [hit.item.city, t(`company.status.${hit.item.status}`)].filter(Boolean).join(' · '),
        };
      case 'customer':
        return { key: `customer:${hit.item.id}`, to: hitPath(hit), icon: 'customers', title: hit.item.fullName || hit.item.email || '—', subtitle: hit.item.email };
      case 'order':
        return {
          key: `order:${hit.item.id}`,
          to: hitPath(hit),
          icon: 'orders',
          title: `#${shortId(hit.item.id)} · ${customerLabel(hit.item)}`,
          subtitle: [hit.item.companyName, money(hit.item.totalAmount)].filter(Boolean).join(' · '),
        };
      case 'product':
        return { key: `product:${hit.item.id}`, to: hitPath(hit), icon: 'products', title: hit.item.name || '—', subtitle: hit.item.companyName };
    }
  };

  // What is shown: only the answer to what is typed now (a stale one is not mixed in).
  const current = found && found.term === trimmed ? found.results : null;
  const groups = useMemo(() => {
    const out: { id: string; title: string; rows: Row[]; unavailable?: boolean }[] = [];
    const records: typeof out = [];
    if (current) {
      for (const kind of SEARCH_KINDS) {
        const piece = current[kind];
        if (!piece.ok) records.push({ id: kind, title: t(KIND_TITLE[kind]), rows: [], unavailable: true });
        else if (piece.value.length > 0) {
          records.push({ id: kind, title: t(KIND_TITLE[kind]), rows: piece.value.map((h) => ({ ...describe(h), tag: t(KIND_TITLE[kind]) })) });
        }
      }
    }
    if (quick.length > 0) out.push({ id: 'quick', title: t('search.quick'), rows: quick });
    // What you are looking for (a record) comes before the pages.
    out.push(...records);
    if (pages.length > 0) out.push({ id: 'pages', title: t('search.pages'), rows: pages });
    return out;
    // `describe` only reads the language through t and money.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, quick, current, t, money]);

  const rows = groups.flatMap((g) => g.rows);
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));

  const go = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    navigate(row.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(rows.length === 0 ? 0 : (activeIndex + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(rows.length === 0 ? 0 : (activeIndex - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(rows[activeIndex]);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, listId]);

  const nothing = wantsRecords && current !== null && !searching && rows.length === 0;
  let index = -1;

  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={t('search.title')} onKeyDown={onKeyDown}>
        <div className="palette__bar">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-activedescendant={rows.length > 0 ? `${listId}-${activeIndex}` : undefined}
            aria-autocomplete="list"
            type="text"
            value={term}
            placeholder={t('search.placeholder')}
            onChange={(e) => {
              setTerm(e.target.value);
              setActive(0);
            }}
          />
          <kbd className="palette__esc">Esc</kbd>
        </div>
        <div className="palette__body" id={listId} role="listbox" aria-label={t('search.results')}>
          {groups.map((group) => (
            <div key={group.id} role="group" aria-label={group.title}>
              <p className="palette__group">{group.title}</p>
              {group.unavailable && <p className="palette__note muted">{t('search.unavailable', { what: group.title })}</p>}
              {group.rows.map((row) => {
                index += 1;
                const mine = index;
                return (
                  <div
                    key={row.key}
                    id={`${listId}-${mine}`}
                    role="option"
                    aria-selected={mine === activeIndex}
                    className={mine === activeIndex ? 'palette__row palette__row--active' : 'palette__row'}
                    onMouseMove={() => setActive(mine)}
                    onClick={() => go(row)}
                  >
                    <span className="palette__tile">
                      <Icon name={row.icon} size={18} />
                    </span>
                    <span className="palette__text">
                      <strong>
                        <bdi>{row.title}</bdi>
                      </strong>
                      {row.subtitle && (
                        <small>
                          <bdi>{row.subtitle}</bdi>
                        </small>
                      )}
                    </span>
                    {row.tag && <span className="palette__tag">{row.tag}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {wantsRecords && (searching || current === null) && (
            <p className="palette__note muted" role="status">
              {t('search.searching')}
            </p>
          )}
          {nothing && (
            <p className="palette__note muted" role="status">
              {t('search.none')}
            </p>
          )}
          {!wantsRecords && trimmed.length > 0 && <p className="palette__note muted">{t('search.keepTyping')}</p>}
        </div>
        <p className="palette__foot muted">{t('search.hint')}</p>
      </div>
    </div>
  );
}

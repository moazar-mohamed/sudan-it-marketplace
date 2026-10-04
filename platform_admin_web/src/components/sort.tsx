import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';

/*
 * Click-to-sort column headings. A heading cycles ascending, descending, back
 * to the order the page already had. Empty values always sort last, so a
 * missing date or price never hides the real ones at the top. Pages define
 * their accessors once, outside the component, so they stay the same between renders.
 */

export type SortDirection = 'asc' | 'desc';
export type SortValue = string | number | Date | null | undefined;

export interface SortState<K extends string> {
  key: K;
  dir: SortDirection;
}

export function useSortedRows<T, K extends string>(
  rows: readonly T[],
  accessors: Record<K, (row: T) => SortValue>,
): { rows: T[]; sort: SortState<K> | null; toggle: (key: K) => void } {
  const { locale } = useI18n();
  const [sort, setSort] = useState<SortState<K> | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return [...rows];
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    const read = accessors[sort.key];
    const factor = sort.dir === 'asc' ? 1 : -1;
    const norm = (v: SortValue): string | number | null =>
      v === null || v === undefined || v === '' ? null : v instanceof Date ? v.getTime() : v;
    // Array.prototype.sort is stable, so equal rows keep their incoming order.
    return [...rows].sort((a, b) => {
      const x = norm(read(a));
      const y = norm(read(b));
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * factor;
      return collator.compare(String(x), String(y)) * factor;
    });
  }, [rows, sort, locale, accessors]);

  const toggle = (key: K) =>
    setSort((now) =>
      !now || now.key !== key ? { key, dir: 'asc' } : now.dir === 'asc' ? { key, dir: 'desc' } : null,
    );

  return { rows: sorted, sort, toggle };
}

/** A column heading that sorts its column when clicked. */
export function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
}) {
  const { t } = useI18n();
  const active = sort?.key === sortKey ? sort.dir : null;
  return (
    <th aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}>
      <button
        type="button"
        className="th-sort"
        onClick={() => onSort(sortKey)}
        title={t('table.sortBy', { column: label })}
      >
        {label}
      </button>
    </th>
  );
}

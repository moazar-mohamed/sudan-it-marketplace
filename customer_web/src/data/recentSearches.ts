import { normalizeSearchText } from './searchRanking';

const KEY = 'recent_searches';
const MAX = 8;

export function readRecentSearches(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function save(list: string[]): string[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: recent searches just won't persist */
  }
  return list;
}

/** Puts [query] first; the same search typed differently is kept once. */
export function addRecentSearch(query: string): string[] {
  const text = query.trim();
  if (text === '') return readRecentSearches();
  const key = normalizeSearchText(text);
  return save(
    [text, ...readRecentSearches().filter((old) => normalizeSearchText(old) !== key)].slice(0, MAX),
  );
}

export const removeRecentSearch = (query: string): string[] =>
  save(readRecentSearches().filter((old) => old !== query));

export const clearRecentSearches = (): string[] => save([]);

import { SYNONYM_GROUPS } from './synonyms';

// Port of lib/core/utils/search_ranking.dart and arabic_text.dart: the site and
// the app must find and order the same things for the same words.

/** One piece of searchable text and how much a hit in it is worth. */
export interface SearchField {
  text: string;
  weight?: number;
}

export function normalizeSearchText(value: string): string {
  return value
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}

/**
 * [items] matching [query], best first. Every word must match somewhere, in any
 * order; an empty query keeps every item in its order. Equal matches go by the
 * higher [tieBreak], then the original order.
 */
export function searchRanked<T>(
  items: Iterable<T>,
  query: string,
  fieldsOf: (item: T) => SearchField[],
  tieBreak?: (item: T) => number,
): T[] {
  const list = [...items];
  const tokens = toTokens(query);
  if (tokens.length === 0) return list;

  const wholeQuery = tokens.join(' ');
  const scored: { item: T; index: number; score: number; tie: number }[] = [];
  list.forEach((item, index) => {
    const score = scoreOf(tokens, wholeQuery, fieldsOf(item));
    if (score > 0) scored.push({ item, index, score, tie: tieBreak?.(item) ?? 0 });
  });
  scored.sort((a, b) => b.score - a.score || b.tie - a.tie || a.index - b.index);
  return scored.map((entry) => entry.item);
}

/** The query as the matcher sees it, to pass to [searchWordHit] for each shown word. */
export const searchQueryTokens = (query: string): string[] => toTokens(query);

/** Whether one displayed [word] is one the query matched. */
export function searchWordHit(word: string, queryTokens: string[]): boolean {
  const wordTokens = toTokens(word);
  return queryTokens.some((query) => wordTokens.some((token) => tokenScore(query, token) > 0));
}

/**
 * "Did you mean ...": [query] with the words that match nothing replaced by the
 * closest word of [vocabulary]; null when nothing needs changing or nothing is
 * close enough, so a correct query is never rewritten.
 */
export function suggestCorrection(query: string, vocabulary: Iterable<string>): string | null {
  const tokens = toTokens(query);
  if (tokens.length === 0) return null;
  const words = new Set<string>();
  for (const text of vocabulary) toTokens(text).forEach((word) => words.add(word));
  if (words.size === 0) return null;

  let changed = false;
  const corrected: string[] = [];
  for (const token of tokens) {
    const known = [...words].some(
      (word) =>
        word === token || word.startsWith(token) || (token.length >= 3 && word.includes(token)),
    );
    if (known || token.length < 3) {
      corrected.push(token);
      continue;
    }
    // More forgiving than the search itself: this only runs when nothing was found.
    const allowed = token.length >= 5 ? 2 : 1;
    let best: string | null = null;
    let bestDistance = allowed + 1;
    for (const word of words) {
      if (Math.abs(word.length - token.length) > allowed) continue;
      for (let max = 1; max <= allowed && max < bestDistance; max++) {
        if (withinEdits(token, word, max)) {
          best = word;
          bestDistance = max;
          break;
        }
      }
    }
    if (best === null) {
      corrected.push(token);
    } else {
      corrected.push(best);
      changed = true;
    }
  }
  return changed ? corrected.join(' ') : null;
}

const EXACT = 10;
const PREFIX = 7;
const INSIDE = 4;
const TYPO = 2;

function scoreOf(queryTokens: string[], wholeQuery: string, fields: SearchField[]): number {
  const indexed = fields
    .filter((field) => field.text.trim() !== '')
    .map((field) => {
      const words = toTokens(field.text);
      return { words, tokens: withJoined(words), weight: field.weight ?? 1 };
    });
  let total = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const field of indexed) {
      for (const token of field.tokens) {
        const hit = tokenScore(queryToken, token);
        if (hit > 0 && hit * field.weight > best) best = hit * field.weight;
      }
    }
    if (best === 0) return 0; // every word must match somewhere
    total += best;
  }
  // The words together, in order, in the best field: a clear favourite.
  for (const field of indexed) {
    const joined = field.words.join(' ');
    if (joined === wholeQuery) total += 20 * field.weight;
    else if (joined.startsWith(wholeQuery)) total += 8 * field.weight;
    else if (queryTokens.length > 1 && joined.includes(wholeQuery)) total += 4 * field.weight;
  }
  return total;
}

/** The words also count as one run, so "tplink" finds "TP-Link". */
const withJoined = (tokens: string[]): string[] =>
  tokens.length > 1 ? [...tokens, tokens.join('')] : tokens;

function tokenScore(query: string, token: string): number {
  if (token === query) return EXACT;
  if (token.startsWith(query)) return PREFIX;
  if (query.length >= 3 && token.includes(query)) return INSIDE;
  if (query.length >= 4) {
    const allowed = query.length >= 7 ? 2 : 1;
    // Whole word, or just as much of the word as was typed so far.
    const head = token.length > query.length ? token.substring(0, query.length) : token;
    if (withinEdits(query, token, allowed) || withinEdits(query, head, allowed)) return TYPO;
  }
  return 0;
}

/** Whether [a] and [b] are at most [max] edits apart (insert, delete, replace, swap). */
function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  let beforePrevious: number[] | null = null;
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1).fill(0);
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (
        beforePrevious !== null &&
        i > 1 &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        value = Math.min(value, beforePrevious[j - 2] + 1);
      }
      current[j] = value;
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length] <= max;
}

const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;
const SPACES = /\s+/g;

const tokenCache = new Map<string, string[]>();

/** Words of [value] in a form the query and the data share (remembered per text). */
function toTokens(value: string): string[] {
  const cached = tokenCache.get(value);
  if (cached) return cached;
  const tokens = computeTokens(value);
  if (tokenCache.size >= 4000) tokenCache.clear();
  tokenCache.set(value, tokens);
  return tokens;
}

function computeTokens(value: string): string[] {
  let text = normalizeSearchText(value).replace(PUNCTUATION, ' ').replace(SPACES, ' ').trim();
  if (text === '') return [];
  // Articles go first so "الطابعة" becomes the same word as "طابعة".
  text = text.split(' ').map(stripArticle).join(' ');
  for (const rule of synonymRules()) {
    text = text.replace(rule.pattern, () => rule.canonical);
  }
  return text.split(' ').filter((word) => word !== '');
}

const stripArticle = (word: string): string =>
  word.length >= 5 && word.startsWith('ال') ? word.substring(2) : word;

interface SynonymRule {
  canonical: string;
  pattern: RegExp;
}

let rules: SynonymRule[] | null = null;

function synonymRules(): SynonymRule[] {
  if (rules) return rules;
  const built: SynonymRule[] = [];
  for (const group of SYNONYM_GROUPS) {
    const canonical = normalizeSearchText(group[0]);
    for (const variant of group) {
      const normalized = normalizeSearchText(variant)
        .replace(PUNCTUATION, ' ')
        .replace(SPACES, ' ')
        .trim();
      if (normalized === '' || normalized === canonical) continue;
      built.push({
        canonical,
        // Whole words only, so "ups" never rewrites the inside of "groups".
        pattern: new RegExp(`(?<![\\p{L}\\p{N}])${normalized}(?![\\p{L}\\p{N}])`, 'gu'),
      });
    }
  }
  // Longest phrases first: "كاميرا مراقبه" must win over "كاميرا".
  built.sort((a, b) => b.pattern.source.length - a.pattern.source.length);
  rules = built;
  return built;
}

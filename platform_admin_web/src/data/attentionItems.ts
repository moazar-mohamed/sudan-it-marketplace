import type { TranslationKey } from '../i18n/dictionary';
import type { AttentionCounts } from './attention';
import {
  LOW_RATING_MAX,
  LOW_REVIEW_DAYS,
  NO_PRODUCTS_GRACE_DAYS,
  STALE_REQUEST_HOURS,
  STUCK_ORDER_DAYS,
  UNVERIFIED_PAYMENT_HOURS,
} from './stats';

export type Severity = 'high' | 'medium' | 'info';

export interface AttentionItem {
  key: keyof AttentionCounts;
  severity: Severity;
  /** undefined = not read yet, null = could not be read. */
  count: number | null | undefined;
  label: string;
  /** The list narrowed by the same rule, so a count is exactly the rows behind it. */
  to: string;
}

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/**
 * The "needs your attention" rules, as the dashboard panel and the alerts bell
 * both show them: the count of each rule, how urgent it is, and where to act.
 */
export function attentionItems(found: AttentionCounts | null, t: Translate): AttentionItem[] {
  return [
    {
      key: 'unverified',
      severity: 'high',
      count: found?.unverified,
      label: t('attention.unverified', { hours: UNVERIFIED_PAYMENT_HOURS }),
      to: '/orders?attention=unverified',
    },
    {
      key: 'stuck',
      severity: 'medium',
      count: found?.stuck,
      label: t('attention.stuck', { days: STUCK_ORDER_DAYS }),
      to: '/orders?attention=stuck',
    },
    {
      key: 'staleRequests',
      severity: 'medium',
      count: found?.staleRequests,
      label: t('attention.staleRequests', { hours: STALE_REQUEST_HOURS }),
      to: '/service-requests?attention=stale',
    },
    {
      key: 'lowReviews',
      severity: 'medium',
      count: found?.lowReviews,
      label: t('attention.lowReviews', { stars: LOW_RATING_MAX, days: LOW_REVIEW_DAYS }),
      to: '/reviews?attention=low',
    },
    {
      key: 'noProducts',
      severity: 'info',
      count: found?.noProducts,
      label: t('attention.noProducts', { days: NO_PRODUCTS_GRACE_DAYS }),
      to: '/companies?attention=noProducts',
    },
  ];
}

/** How many records need attention in all (those that could be read); null when none could. */
export function attentionTotal(found: AttentionCounts | null): number | null {
  if (!found) return null;
  const known = Object.values(found).filter((c): c is number => c !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

import { useEffect, useRef } from 'react';
import { attentionCounts } from '../data/attention';
import { attentionTotal } from '../data/attentionItems';
import type { DashboardSnapshot } from '../data/dashboardData';
import { useI18n } from '../i18n/I18nProvider';
import { setTitleBadge } from '../ui/titleBadge';
import { useToast } from './feedback';

/**
 * Keeps the browser tab's title in step with how many records need attention
 * and, when a fresh read finds MORE than the one before, says so with a toast.
 * The first read only sets the baseline: opening the panel is not news.
 */
export function useAttentionAlerts(snapshot: DashboardSnapshot | null, newReports: number | null = 0): void {
  const { t, number } = useI18n();
  const toast = useToast();
  const previous = useRef<number | null>(null);
  const previousReports = useRef<number | null>(null);

  // New reports are live (a listener, not a read now and then), so one that
  // arrives while the panel is open says so at once; the first count is only the baseline.
  useEffect(() => {
    if (newReports === null) return;
    if (previousReports.current !== null && newReports > previousReports.current) {
      toast(t('alerts.newReports', { count: number(newReports - previousReports.current) }), 'info');
    }
    previousReports.current = newReports;
    // The toast words change with the language, not the news.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newReports]);

  // The tab's number is everything that needs attention: the figures read, and the reports waiting.
  const waiting = newReports ?? 0;
  useEffect(() => {
    const total = snapshot ? attentionTotal(attentionCounts(snapshot)) : null;
    setTitleBadge((total ?? 0) + waiting);
  }, [snapshot, waiting]);

  useEffect(() => {
    if (!snapshot) return;
    const total = attentionTotal(attentionCounts(snapshot));
    if (total === null) return;
    if (previous.current !== null && total > previous.current) {
      toast(t('alerts.new', { count: number(total - previous.current) }), 'info');
    }
    previous.current = total;
    // Only a new read (its clock) is news; the translators change with the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  // Leaving the panel (signing out) takes the number off the tab again.
  useEffect(() => () => setTitleBadge(0), []);
}

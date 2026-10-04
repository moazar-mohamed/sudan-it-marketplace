import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AttentionBanner } from '../components/AttentionBanner';
import { useConfirm, useRunner } from '../components/feedback';
import { SortTh, useSortedRows } from '../components/sort';
import { Badge, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { setReviewHidden } from '../data/actions';
import { csvFilename, downloadCsv, reviewsToCsv } from '../data/csv';
import { useReviews } from '../data/hooks';
import { isRecentLowReview, LOW_RATING_MAX, LOW_REVIEW_DAYS } from '../data/stats';
import type { Review } from '../data/types';
import { useNow } from '../data/useNow';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery, shortId } from '../utils';

const SORTS = {
  customer: (r: Review) => r.customerName,
  company: (r: Review) => r.companyName,
  target: (r: Review) => r.targetName,
  rating: (r: Review) => r.rating,
  order: (r: Review) => r.orderId,
  date: (r: Review) => r.createdAt,
  status: (r: Review) => (r.hidden ? 1 : 0),
};

export function ReviewsPage() {
  const { t, number, date } = useI18n();
  const reviews = useReviews();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const [query, setQuery] = useState('');
  // ?attention=low narrows the list to the recent low-star reviews the dashboard flagged.
  const [params, setParams] = useSearchParams();
  const low = params.get('attention') === 'low';
  const now = useNow();

  const visible = reviews.data
    .filter((r) => !low || isRecentLowReview(r, now))
    .filter((r) => matchesQuery(query, r.customerName, r.companyName, r.targetName, r.comment))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  const { rows: sortedRows, sort, toggle: toggleSort } = useSortedRows(visible, SORTS);

  // Hiding takes the stars out of the averages; showing puts them back.
  const toggle = async (r: Review) => {
    if (!r.hidden) {
      const ok = await confirm({
        title: t('reviews.confirmHide.title'),
        body: t('reviews.confirmHide.body', { name: r.customerName || '—' }),
        confirmLabel: t('reviews.hide'),
        danger: true,
      });
      if (!ok) return;
    }
    await run(r.id, () => setReviewHidden(r, !r.hidden), t('reviews.updated'));
  };

  return (
    <>
      <PageHeader
        title={t('reviews.title')}
        subtitle={t('reviews.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button
            className="btn btn--sm"
            disabled={visible.length === 0}
            onClick={() => downloadCsv(csvFilename('reviews', Date.now()), reviewsToCsv(visible))}
          >
            {t('common.exportCsv')}
          </button>
        }
      />
      <DataGate gates={[reviews]}>
        {reviews.data.length === 0 ? (
          <EmptyState message={t('reviews.empty')} hint={t('reviews.emptyHint')} />
        ) : (
          <>
            {low && (
              <AttentionBanner
                label={t('attention.lowReviews', { stars: LOW_RATING_MAX, days: LOW_REVIEW_DAYS })}
                onClear={() => setParams({}, { replace: true })}
              />
            )}
            <div className="toolbar">
              <div className="toolbar__end">
                <SearchInput value={query} onChange={setQuery} placeholder={t('common.search')} />
              </div>
            </div>
            {visible.length === 0 ? (
              <EmptyState message={t('common.noResults')} />
            ) : (
              <div className="card">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <SortTh label={t('col.customer')} sortKey="customer" sort={sort} onSort={toggleSort} />
                        <SortTh label={t('col.company')} sortKey="company" sort={sort} onSort={toggleSort} />
                        <SortTh label={t('reviews.rated')} sortKey="target" sort={sort} onSort={toggleSort} />
                        <SortTh label={t('col.rating')} sortKey="rating" sort={sort} onSort={toggleSort} />
                        <th>{t('col.comment')}</th>
                        <SortTh label={t('col.order')} sortKey="order" sort={sort} onSort={toggleSort} />
                        <SortTh label={t('col.date')} sortKey="date" sort={sort} onSort={toggleSort} />
                        <SortTh label={t('col.status')} sortKey="status" sort={sort} onSort={toggleSort} />
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <Text>{r.customerName || '—'}</Text>
                          </td>
                          <td>
                            <Text>{r.companyName || '—'}</Text>
                          </td>
                          <td>
                            <Text>{r.targetName || '—'}</Text>
                          </td>
                          <td className="nowrap">{number(r.rating)} ★</td>
                          <td className="cell-wrap">
                            {r.comment ? <Text>{r.comment}</Text> : '—'}
                            {r.reply && (
                              <div className="muted">
                                {t('reviews.reply')}: <Text>{r.reply}</Text>
                              </div>
                            )}
                          </td>
                          <td>
                            {r.orderId ? (
                              <Link to={`/orders/${r.orderId}`} className="mono" dir="ltr">
                                #{shortId(r.orderId)}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="nowrap">{date(r.createdAt)}</td>
                          <td>
                            <Badge tone={r.hidden ? 'warning' : 'success'}>
                              {r.hidden ? t('reviews.hiddenBadge') : t('reviews.visible')}
                            </Badge>
                          </td>
                          <td>
                            <button
                              className={r.hidden ? 'btn btn--sm' : 'btn btn--danger-ghost btn--sm'}
                              disabled={busy === r.id}
                              onClick={() => void toggle(r)}
                            >
                              {r.hidden ? t('reviews.show') : t('reviews.hide')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </DataGate>
    </>
  );
}

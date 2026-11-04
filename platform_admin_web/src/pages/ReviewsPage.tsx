import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AttentionBanner } from '../components/AttentionBanner';
import { useConfirm, useRunner } from '../components/feedback';
import { SortTh, useSortedRows } from '../components/sort';
import { Badge, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { ExportAction, FilterGroup } from '../components/v2';
import { setReviewHidden } from '../data/actions';
import { csvFilename, downloadCsv, reviewsToCsv } from '../data/csv';
import { useReviews } from '../data/hooks';
import { isRecentLowReview, LOW_RATING_MAX, LOW_REVIEW_DAYS } from '../data/stats';
import type { Review } from '../data/types';
import { useNow } from '../data/useNow';
import { useI18n } from '../i18n/I18nProvider';
import { useUi } from '../theme/ui';
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
  const v2 = useUi().ui === 'v2';
  // The redesign's own filters; the current look keeps its search only.
  const [stars, setStars] = useState('');
  const [vis, setVis] = useState('');
  const [order, setOrder] = useState('newest');

  const visible = reviews.data
    .filter((r) => !low || isRecentLowReview(r, now))
    .filter((r) => matchesQuery(query, r.customerName, r.companyName, r.targetName, r.comment))
    .filter((r) => !v2 || !stars || Math.round(r.rating) === Number(stars))
    .filter((r) => !v2 || !vis || (vis === 'hidden') === r.hidden)
    .sort((a, b) => {
      const byDate = (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      if (!v2 || order === 'newest') return byDate;
      return (order === 'lowest' ? a.rating - b.rating : b.rating - a.rating) || byDate;
    });
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
          <ExportAction
            label={t('common.exportCsv')}
            disabled={visible.length === 0}
            onExport={() => downloadCsv(csvFilename('reviews', Date.now()), reviewsToCsv(visible))}
          />
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
            {v2 && <ReviewsSummary reviews={reviews.data} />}
            <div className="toolbar">
              {v2 && (
                <FilterGroup
                  count={(stars ? 1 : 0) + (vis ? 1 : 0)}
                  onClear={() => {
                    setStars('');
                    setVis('');
                  }}
                >
                  <select className="select" value={stars} aria-label={t('col.rating')} onChange={(e) => setStars(e.target.value)}>
                    <option value="">{t('reviews.allStars')}</option>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {'★'.repeat(n)} {t('reviews.starsOnly', { n: number(n) })}
                      </option>
                    ))}
                  </select>
                  <select className="select" value={vis} aria-label={t('col.status')} onChange={(e) => setVis(e.target.value)}>
                    <option value="">{t('reviews.allVisibility')}</option>
                    <option value="visible">{t('reviews.visible')}</option>
                    <option value="hidden">{t('reviews.hiddenBadge')}</option>
                  </select>
                </FilterGroup>
              )}
              <div className="toolbar__end">
                {v2 && (
                  <select className="select" value={order} aria-label={t('reviews.sortLabel')} onChange={(e) => setOrder(e.target.value)}>
                    <option value="newest">{t('reviews.sortNewest')}</option>
                    <option value="lowest">{t('reviews.sortLowest')}</option>
                    <option value="highest">{t('reviews.sortHighest')}</option>
                  </select>
                )}
                <SearchInput value={query} onChange={setQuery} placeholder={t('common.search')} />
              </div>
            </div>
            {visible.length === 0 ? (
              <EmptyState message={t('common.noResults')} />
            ) : v2 ? (
              <div className="review-list">
                {visible.map((r) => (
                  <article key={r.id} className={r.hidden ? 'review-card review-card--hidden' : 'review-card'}>
                    <header className="review-card__head">
                      <span className="review-card__stars" role="img" aria-label={`${number(r.rating)} ★`}>
                        {'★'.repeat(Math.round(r.rating))}
                        <span aria-hidden="true">{'★'.repeat(5 - Math.round(r.rating))}</span>
                      </span>
                      <Badge tone={r.hidden ? 'warning' : 'success'}>{r.hidden ? t('reviews.hiddenBadge') : t('reviews.visible')}</Badge>
                    </header>
                    <p className="review-card__comment">
                      {r.comment ? <Text>{r.comment}</Text> : <span className="muted">{t('reviews.noComment')}</span>}
                    </p>
                    {r.reply && (
                      <p className="review-card__reply">
                        <strong>{t('reviews.reply')}:</strong> <Text>{r.reply}</Text>
                      </p>
                    )}
                    <footer className="review-card__foot">
                      <span className="review-card__who">
                        <Text>{r.customerName || '—'}</Text> · {t('reviews.rated')} <Text>{r.targetName || r.companyName || '—'}</Text>
                        {r.targetName && r.companyName && r.targetName !== r.companyName && (
                          <>
                            {' · '}
                            <Text>{r.companyName}</Text>
                          </>
                        )}
                        {' · '}
                        {date(r.createdAt)}
                        {r.orderId && (
                          <>
                            {' · '}
                            <Link to={`/orders/${r.orderId}`} className="mono" dir="ltr">
                              #{shortId(r.orderId)}
                            </Link>
                          </>
                        )}
                      </span>
                      <button className={r.hidden ? 'btn btn--sm' : 'btn btn--danger-ghost btn--sm'} disabled={busy === r.id} onClick={() => void toggle(r)}>
                        {r.hidden ? t('reviews.show') : t('reviews.hide')}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
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

/** The redesign's overview: the average, how many, and how the stars are spread (hidden reviews are left out, as in a company's average). */
function ReviewsSummary({ reviews }: { reviews: Review[] }) {
  const { t, number } = useI18n();
  const shown = reviews.filter((r) => !r.hidden);
  const average = shown.length ? shown.reduce((sum, r) => sum + r.rating, 0) / shown.length : 0;
  const hidden = reviews.length - shown.length;
  return (
    <section className="review-summary card" aria-label={t('reviews.average')}>
      <div className="review-summary__score">
        <strong>{shown.length ? number(Math.round(average * 10) / 10) : '—'}</strong>
        <span className="review-card__stars" aria-hidden="true">
          {'★'.repeat(Math.round(average))}
          <span>{'★'.repeat(5 - Math.round(average))}</span>
        </span>
        <small className="muted">
          {t('reviews.total', { count: number(reviews.length) })}
          {hidden > 0 && ` · ${t('reviews.hiddenCount', { count: number(hidden) })}`}
        </small>
      </div>
      <ul className="review-summary__bars">
        {[5, 4, 3, 2, 1].map((n) => {
          const count = shown.filter((r) => Math.round(r.rating) === n).length;
          return (
            <li key={n}>
              <span>{number(n)} ★</span>
              <span className="review-summary__bar">
                <span style={{ width: `${shown.length ? (count / shown.length) * 100 : 0}%` }} />
              </span>
              <span className="muted">{number(count)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

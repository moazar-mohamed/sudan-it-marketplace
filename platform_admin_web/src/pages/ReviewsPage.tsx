import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm, useRunner } from '../components/feedback';
import { Badge, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { setReviewHidden } from '../data/actions';
import { useReviews } from '../data/hooks';
import type { Review } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery, shortId } from '../utils';

export function ReviewsPage() {
  const { t, number, date } = useI18n();
  const reviews = useReviews();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const [query, setQuery] = useState('');

  const visible = reviews.data
    .filter((r) => matchesQuery(query, r.customerName, r.companyName, r.targetName, r.comment))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

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
      />
      <DataGate gates={[reviews]}>
        {reviews.data.length === 0 ? (
          <EmptyState message={t('reviews.empty')} hint={t('reviews.emptyHint')} />
        ) : (
          <>
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
                        <th>{t('col.customer')}</th>
                        <th>{t('col.company')}</th>
                        <th>{t('reviews.rated')}</th>
                        <th>{t('col.rating')}</th>
                        <th>{t('col.comment')}</th>
                        <th>{t('col.order')}</th>
                        <th>{t('col.date')}</th>
                        <th>{t('col.status')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => (
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

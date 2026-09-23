import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { useReviews } from '../data/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery, shortId } from '../utils';

export function ReviewsPage() {
  const { t, number, date } = useI18n();
  const reviews = useReviews();
  const [query, setQuery] = useState('');

  const visible = reviews.data.filter((r) =>
    matchesQuery(query, r.customerName, r.companyName, r.comment),
  );

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
                        <th>{t('col.rating')}</th>
                        <th>{t('col.comment')}</th>
                        <th>{t('col.order')}</th>
                        <th>{t('col.date')}</th>
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
                          <td className="nowrap">{number(r.rating)} ★</td>
                          <td className="cell-wrap">
                            {r.comment ? <Text>{r.comment}</Text> : '—'}
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

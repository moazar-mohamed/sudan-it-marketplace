import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUsage, type Piece, type UsageFigures } from '../data/usageQueries';
import { db } from '../firebase';
import { useI18n } from '../i18n/I18nProvider';
import { LineChart } from './charts';
import { Card, Disclosure, EmptyState, Text } from './ui';

/** Reads the figures once when it appears, and again each time [reload] changes. */
function useUsageFigures(reload: number): UsageFigures | null {
  const [now] = useState(Date.now);
  const [figures, setFigures] = useState<{ reload: number; value: UsageFigures } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchUsage(db, now).then((value) => {
      if (!cancelled) setFigures({ reload, value });
    });
    return () => {
      cancelled = true;
    };
  }, [now, reload]);
  // A figure from before the last Refresh is not shown as the answer to it.
  return figures && figures.reload === reload ? figures.value : null;
}

function DailyChart({ title, days, piece }: { title: string; days: string[]; piece: Piece<number[]> }) {
  const { t, number, date } = useI18n();
  const label = (day: string) => date(new Date(`${day}T12:00:00+02:00`));
  return (
    <Card title={title}>
      {!piece.ok ? (
        <p className="field__error" role="alert">
          {t('usage.failed')}
        </p>
      ) : (
        <LineChart
          values={piece.value}
          pointLabels={piece.value.map((v, i) => `${label(days[i])}: ${number(v)}`)}
          formatAxis={(v) => number(Math.round(v))}
          startLabel={label(days[0])}
          endLabel={label(days[days.length - 1])}
          summary={`${title}: ${piece.value.map((v) => number(v)).join(', ')}`}
        />
      )}
    </Card>
  );
}

function UsageBody() {
  const { t, number } = useI18n();
  const [reload, setReload] = useState(0);
  const figures = useUsageFigures(reload);

  return (
    <>
      <div className="usage__bar">
        <p className="muted usage__note">{t('usage.note')}</p>
        <button className="btn btn--sm" disabled={!figures} onClick={() => setReload((n) => n + 1)}>
          {t('dashboard.refresh')}
        </button>
      </div>
      {!figures ? (
        <p className="muted" role="status">
          {t('common.loading')}
        </p>
      ) : (
        <>
          <div className="grid-2">
            <DailyChart title={t('usage.active')} days={figures.days} piece={figures.active} />
            <DailyChart title={t('usage.newCustomers')} days={figures.days} piece={figures.newCustomers} />
          </div>
          <Card title={t('usage.mostViewed')} flush>
            {!figures.mostViewed.ok ? (
              <p className="field__error" role="alert">
                {t('usage.failed')}
              </p>
            ) : figures.mostViewed.value.length === 0 ? (
              <EmptyState message={t('usage.noViews')} />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('col.name')}</th>
                      <th>{t('col.company')}</th>
                      <th>{t('usage.views')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {figures.mostViewed.value.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.name ? (
                            <Link to={`/products/${p.id}`}>
                              <Text>{p.name}</Text>
                            </Link>
                          ) : (
                            <span className="muted">{t('usage.removed')}</span>
                          )}
                        </td>
                        <td>
                          <Text>{p.companyName || '—'}</Text>
                        </td>
                        <td>{number(p.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

/** How the apps are used: people active each day, new customers, and the products opened most. Reads only when opened. */
export function UsageSection() {
  const { t } = useI18n();
  return (
    <Disclosure title={t('usage.title')} icon="activity" lazy>
      <UsageBody />
    </Disclosure>
  );
}

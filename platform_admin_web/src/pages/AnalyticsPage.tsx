import { useMemo } from 'react';
import { Card, DataGate, EmptyState, PageHeader, StatCard } from '../components/ui';
import { useCompanies, useOrders } from '../data/hooks';
import { COMPANY_FILTER_STATUSES, ORDER_STATUSES } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';

interface Bar {
  key: string;
  label: string;
  value: number;
  tone?: string;
}

function BarList({ bars, format }: { bars: Bar[]; format: (n: number) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="bars">
      {bars.map((b) => (
        <li key={b.key} className="bars__row">
          <span className="bars__label">{b.label}</span>
          <span className="bars__track">
            <span
              className={`bars__fill${b.tone ? ` bars__fill--${b.tone}` : ''}`}
              style={{ width: `${(b.value / max) * 100}%` }}
            />
          </span>
          <span className="bars__value">{format(b.value)}</span>
        </li>
      ))}
    </ul>
  );
}

const ORDER_TONE = { processing: 'info', out_for_delivery: 'warning', completed: 'success' } as const;
const COMPANY_TONE = { active: 'success', inactive: 'neutral' } as const;

export function AnalyticsPage() {
  const { t, number, money, locale } = useI18n();
  const orders = useOrders();
  const companies = useCompanies();

  const stats = useMemo(() => {
    const totalValue = orders.data.reduce((sum, o) => sum + o.totalAmount, 0);
    const confirmedValue = orders.data
      .filter((o) => o.paymentStatus === 'confirmed')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // Calendar months, oldest first, ending with the current month.
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth(), start: d, count: 0 };
    });
    for (const o of orders.data) {
      if (!o.createdAt) continue;
      const m = months.find(
        (x) => x.year === o.createdAt!.getFullYear() && x.month === o.createdAt!.getMonth(),
      );
      if (m) m.count += 1;
    }
    return { totalValue, confirmedValue, months };
  }, [orders.data]);

  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
      month: 'short',
      year: '2-digit',
    }),
    [locale],
  );

  const count = (status: string) => orders.data.filter((o) => o.orderStatus === status).length;

  return (
    <>
      <PageHeader title={t('analytics.title')} subtitle={t('analytics.subtitle')} />

      <DataGate gates={[orders, companies]}>
        <div className="stat-grid">
          <StatCard icon="orders" label={t('analytics.totalOrders')} value={number(orders.data.length)} />
          <StatCard icon="analytics" label={t('analytics.totalValue')} value={money(stats.totalValue)} />
          <StatCard
            icon="analytics"
            label={t('analytics.confirmedValue')}
            value={money(stats.confirmedValue)}
          />
          <StatCard
            icon="orders"
            label={t('analytics.processing')}
            value={number(count('processing'))}
          />
          <StatCard
            icon="orders"
            label={t('analytics.completed')}
            value={number(count('completed'))}
          />
        </div>

        <div className="grid-2">
          <Card title={t('analytics.ordersByStatus')}>
            {orders.data.length === 0 ? (
              <EmptyState message={t('analytics.noData')} />
            ) : (
              <BarList
                format={number}
                bars={ORDER_STATUSES.map((s) => ({
                  key: s,
                  label: t(`order.status.${s}`),
                  value: count(s),
                  tone: ORDER_TONE[s],
                }))}
              />
            )}
          </Card>
          <Card title={t('analytics.companiesByStatus')}>
            {companies.data.length === 0 ? (
              <EmptyState message={t('analytics.noData')} />
            ) : (
              <BarList
                format={number}
                bars={COMPANY_FILTER_STATUSES.map((s) => ({
                  key: s,
                  label: t(`company.status.${s}`),
                  value: companies.data.filter((c) => c.status === s).length,
                  tone: COMPANY_TONE[s],
                }))}
              />
            )}
          </Card>
        </div>

        <Card title={t('analytics.last6Months')}>
          {orders.data.length === 0 ? (
            <EmptyState message={t('analytics.noData')} />
          ) : (
            <BarList
              format={number}
              bars={stats.months.map((m) => ({
                key: `${m.year}-${m.month}`,
                label: monthFmt.format(m.start),
                value: m.count,
                tone: 'info',
              }))}
            />
          )}
        </Card>
      </DataGate>
    </>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Chips, DataGate, EmptyState, PageHeader, StatCard, Text } from '../components/ui';
import { RowMenu } from '../components/RowMenu';
import { CitiesSection } from '../components/CitiesSection';
import { UsageSection } from '../components/UsageSection';
import {
  CANCEL_BUCKETS,
  cancelReasons,
  monthlySeries,
  ordersInPeriod,
  ordersToCsv,
  salesByCompanyToCsv,
  salesByDayToCsv,
  salesByProductToCsv,
  PAYMENT_WINDOW_HOURS,
  PERIODS,
  summarizeOrders,
  topCompanies,
  topProducts,
  undatedOrders,
  type Period,
  type RankRow,
} from '../data/analytics';
import { csvFilename, downloadCsv } from '../data/csv';
import { useCompanies, useCustomers } from '../data/hooks';
import { useOrdersSince } from '../data/orderHooks';
import { COMPANY_FILTER_STATUSES, ORDER_STATUSES } from '../data/types';
import { useNow } from '../data/useNow';
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

const ORDER_TONE = {
  processing: 'info',
  out_for_delivery: 'warning',
  completed: 'success',
  cancelled: 'danger',
} as const;
const COMPANY_TONE = { active: 'success', inactive: 'neutral' } as const;

function RankTable({
  rows,
  linkTo,
}: {
  rows: RankRow[];
  /** Where a row's name leads; none for rows without a page of their own. */
  linkTo?: (row: RankRow) => string;
}) {
  const { t, number, money } = useI18n();
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>{t('col.name')}</th>
            <th>{t('analytics.col.orders')}</th>
            <th>{t('analytics.col.units')}</th>
            <th>{t('analytics.col.sales')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {linkTo ? (
                  <Link to={linkTo(r)}>
                    <Text>{r.name}</Text>
                  </Link>
                ) : (
                  <Text>{r.name}</Text>
                )}
              </td>
              <td>{number(r.orders)}</td>
              <td>{number(r.units)}</td>
              <td className="nowrap">{money(r.sales)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The orders read for every period but "all time": the last 12 months, with a day's margin either side. */
export const ANALYTICS_WINDOW_DAYS = 366;

export function AnalyticsPage() {
  const { t, number, money, locale } = useI18n();
  const companies = useCompanies();
  const customers = useCustomers();
  const now = useNow();
  const [period, setPeriod] = useState<Period>('30d');
  // The orders of the last year are read (enough for every period but "all time" and for the
  // 12-month charts); "all time" reads every order, which is why it is only read when chosen.
  const [openedAt] = useState(Date.now);
  const since = useMemo(() => (period === 'all' ? null : new Date(openedAt - ANALYTICS_WINDOW_DAYS * 86_400_000)), [period, openedAt]);
  const orders = useOrdersSince(since);
  const orderData = orders.orders;

  const inPeriod = useMemo(() => ordersInPeriod(orderData, period, now), [orderData, period, now]);
  const summary = useMemo(() => summarizeOrders(inPeriod, now), [inPeriod, now]);
  const undated = useMemo(() => undatedOrders(orderData), [orderData]);
  const reasons = useMemo(() => cancelReasons(inPeriod), [inPeriod]);
  const companyRows = useMemo(() => topCompanies(inPeriod), [inPeriod]);
  const productRows = useMemo(() => topProducts(inPeriod), [inPeriod]);
  const months = useMemo(
    () => monthlySeries(orderData, customers.data, 12, now),
    [orderData, customers.data, now],
  );

  const monthFmt = useMemo(
    () =>
      // Each point's label is midnight UTC on the 1st, so format it in UTC to keep the month.
      new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
      }),
    [locale],
  );

  const count = (status: string) => inPeriod.filter((o) => o.orderStatus === status).length;
  const percent = (rate: number | null) => (rate === null ? '–' : `${number(Math.round(rate * 100))}%`);
  const monthBars = (valueOf: (m: (typeof months)[number]) => number, tone: string): Bar[] =>
    months.map((m) => ({
      key: `${m.year}-${m.month}`,
      label: monthFmt.format(m.label),
      value: valueOf(m),
      tone,
    }));

  const exportFile = (name: string, build: (orders: typeof inPeriod) => string) => () =>
    downloadCsv(csvFilename(`${name}-${period}`, now), build(inPeriod));

  return (
    <>
      <PageHeader
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <RowMenu
            text={t('analytics.export')}
            label={t('analytics.exportHint')}
            disabled={inPeriod.length === 0}
            items={[
              { key: 'orders', label: t('analytics.exportCsv'), onSelect: exportFile('orders', ordersToCsv) },
              { key: 'day', label: t('analytics.export.byDay'), onSelect: exportFile('sales-by-day', salesByDayToCsv) },
              { key: 'company', label: t('analytics.export.byCompany'), onSelect: exportFile('sales-by-company', salesByCompanyToCsv) },
              { key: 'product', label: t('analytics.export.byProduct'), onSelect: exportFile('sales-by-product', salesByProductToCsv) },
            ]}
          />
        }
      />

      <DataGate gates={[orders, companies, customers]}>
        <div className="toolbar">
          <Chips
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({
              value: p,
              label: t(`analytics.period.${p}`),
              // Without the whole history, the "all time" count is not known.
              count: p === 'all' && period !== 'all' ? undefined : ordersInPeriod(orderData, p, now).length,
            }))}
          />
        </div>
        {period === 'all' && <p className="muted">{t('analytics.allTimeNote')}</p>}

        <div className="stat-grid">
          <StatCard icon="orders" label={t('analytics.ordersPlaced')} value={number(summary.orders)} />
          <StatCard icon="analytics" label={t('analytics.confirmedSales')} value={money(summary.confirmedSales)} />
          <StatCard
            icon="alert"
            label={t('analytics.awaiting')}
            value={money(summary.awaitingValue)}
            hint={
              summary.overdueOrders > 0
                ? t('analytics.awaitingHint', { count: number(summary.overdueOrders), hours: PAYMENT_WINDOW_HOURS })
                : undefined
            }
          />
          <StatCard
            icon="analytics"
            label={t('analytics.averageOrder')}
            value={summary.averageOrder === null ? '–' : money(summary.averageOrder)}
          />
          <StatCard icon="orders" label={t('analytics.processing')} value={number(summary.processing)} />
          <StatCard icon="orders" label={t('analytics.completed')} value={number(summary.completed)} />
          <StatCard icon="orders" label={t('analytics.cancelled')} value={number(summary.cancelled)} />
          <StatCard icon="alert" label={t('analytics.cancelRate')} value={percent(summary.cancelRate)} />
        </div>

        {period !== 'all' && undated > 0 && <p className="muted">{t('analytics.undatedNote', { count: number(undated) })}</p>}

        <div className="grid-2">
          <Card title={t('analytics.salesBreakdown')}>
            {summary.confirmedSales === 0 ? (
              <EmptyState message={t('analytics.noData')} />
            ) : (
              <BarList
                format={money}
                bars={[
                  { key: 'products', label: t('analytics.part.products'), value: summary.products, tone: 'success' },
                  { key: 'installation', label: t('analytics.part.installation'), value: summary.installation, tone: 'info' },
                  { key: 'delivery', label: t('analytics.part.delivery'), value: summary.delivery, tone: 'warning' },
                ]}
              />
            )}
          </Card>
          <Card title={t('analytics.cancelReasons')}>
            {summary.cancelled === 0 ? (
              <EmptyState message={t('analytics.noData')} />
            ) : (
              <BarList
                format={number}
                bars={CANCEL_BUCKETS.map((b) => ({
                  key: b,
                  label: t(`analytics.reason.${b}`),
                  value: reasons[b],
                  tone: 'danger',
                }))}
              />
            )}
          </Card>
        </div>

        <div className="grid-2">
          <Card title={t('analytics.ordersByStatus')}>
            {inPeriod.length === 0 ? (
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

        <div className="grid-2">
          <Card title={t('analytics.topCompanies')} flush>
            {companyRows.length === 0 ? (
              <EmptyState message={t('analytics.noData')} />
            ) : (
              <RankTable rows={companyRows} linkTo={(r) => `/companies/${r.id}`} />
            )}
          </Card>
          <Card title={t('analytics.topProducts')} flush>
            {productRows.length === 0 ? (
              <EmptyState message={t('analytics.noData')} />
            ) : (
              <RankTable rows={productRows} linkTo={(r) => `/products/${r.id}`} />
            )}
          </Card>
        </div>

        <h2 className="section-title">{t('analytics.last12Months')}</h2>
        <div className="grid-2">
          <Card title={t('analytics.monthOrders')}>
            <BarList format={number} bars={monthBars((m) => m.orders, 'info')} />
          </Card>
          <Card title={t('analytics.monthSales')}>
            <BarList format={money} bars={monthBars((m) => m.sales, 'success')} />
          </Card>
        </div>
        <div className="grid-2">
          <Card title={t('analytics.monthCustomers')}>
            <BarList format={number} bars={monthBars((m) => m.newCustomers, 'info')} />
          </Card>
        </div>

        <CitiesSection />

        <UsageSection />

        <Card title={t('analytics.definitions.title')}>
          <ul className="definitions">
            <li>{t('analytics.definitions.placed')}</li>
            <li>{t('analytics.definitions.confirmed')}</li>
            <li>{t('analytics.definitions.awaiting', { hours: PAYMENT_WINDOW_HOURS })}</li>
            <li>{t('analytics.definitions.cancelRate')}</li>
            <li>{t('analytics.definitions.currency')}</li>
          </ul>
        </Card>
      </DataGate>
    </>
  );
}

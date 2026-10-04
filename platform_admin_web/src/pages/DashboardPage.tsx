import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { LineChart } from '../components/charts';
import { CompanyStatusBadge, OrderStatusBadge } from '../components/StatusBadges';
import { Card, DataGate, EmptyState, PageHeader, StatCard, Text, Thumb } from '../components/ui';
import { isConfirmedSale } from '../data/analytics';
import { activeCompanyCount, type CountKey, type Piece } from '../data/dashboardData';
import {
  compareWindows,
  dailySeries,
  percentChange,
  PERIOD_DAYS,
  type PeriodDays,
} from '../data/stats';
import { useDashboard } from '../data/useDashboard';
import { useI18n } from '../i18n/I18nProvider';
import { customerLabel, shortId } from '../utils';

export function DashboardPage() {
  const { t, number, money, date, dateTime } = useI18n();
  const { snapshot, refreshing, refresh } = useDashboard();
  const { state } = useAuth();
  const profile = state.status === 'authorized' ? state.profile : null;
  const firstName = (profile?.fullName || profile?.email || '').trim().split(/\s+/)[0];
  const [days, setDays] = useState<PeriodDays>(30);
  // "7 days", "30 days": Arabic counts 3-10 as أيام and the rest as يوماً.
  const periodName = (n: number) => t(n <= 10 ? 'period.few' : 'period.many', { days: n });
  const period = periodName(days);

  // The clock the attention rules and the 30-day windows are read against: the
  // moment the figures were read.
  const now = snapshot?.at ?? 0;

  // Every figure comes from its own query, so one that fails does not hide the
  // others: "…" while the first read runs, "–" if it could not be read.
  const source = <T,>(piece: Piece<T[]> | undefined) => ({
    status: !snapshot || !piece ? ('loading' as const) : piece.ok ? ('ready' as const) : ('error' as const),
    data: piece?.ok ? piece.value : ([] as T[]),
    error: null,
    retry: () => void refresh(),
  });
  const windowOrders = source(snapshot?.windowOrders);
  const newCustomers = source(snapshot?.newCustomers);
  const recentOrdersGate = source(snapshot?.recentOrders);
  const recentCompaniesGate = source(snapshot?.recentCompanies);
  const recentOrders = recentOrdersGate.data;
  const recentCompanies = recentCompaniesGate.data;

  const total = (key: CountKey) => {
    const piece = snapshot?.counts[key];
    return !piece ? '…' : piece.ok ? number(piece.value) : '–';
  };
  const activeCompanies = snapshot ? activeCompanyCount(snapshot.counts) : undefined;

  // Each rule's count comes from the same function the sidebar badges use.
  // undefined = not read yet, null = could not be read.

  // The chosen period against the same number of days before, each with its own loading / error state.
  const trend = (
    state: { status: 'loading' | 'ready' | 'error' },
    compute: () => { current: number; previous: number },
    format: (n: number) => string,
    series: () => number[],
  ) => {
    if (state.status !== 'ready') {
      return { value: state.status === 'error' ? '–' : '…', hint: undefined, tone: undefined, spark: undefined };
    }
    const totals = compute();
    const change = percentChange(totals);
    return {
      value: format(totals.current),
      hint:
        change === null
          ? t('trend.noPrevious')
          : t('trend.vsPrevious', {
              change: `${change > 0 ? '+' : change < 0 ? '−' : ''}${number(Math.abs(change))}%`,
              period,
            }),
      tone: change === null || change === 0 ? undefined : change > 0 ? ('up' as const) : ('down' as const),
      spark: series(),
    };
  };
  const placed = (o: { createdAt: Date | null }) => o.createdAt;
  const ordersTrend = trend(
    windowOrders,
    () => compareWindows(windowOrders.data, placed, now, undefined, days),
    number,
    () => dailySeries(windowOrders.data, placed, now, days),
  );
  const confirmed = windowOrders.data.filter(isConfirmedSale);
  const salesTrend = trend(
    windowOrders,
    () => compareWindows(confirmed, placed, now, (o) => o.totalAmount, days),
    money,
    () => dailySeries(confirmed, placed, now, days, (o) => o.totalAmount),
  );
  const customersTrend = trend(
    newCustomers,
    () => compareWindows(newCustomers.data, placed, now, undefined, days),
    number,
    () => dailySeries(newCustomers.data, placed, now, days),
  );

  // The share of the orders placed in the period that were cancelled; a rise is bad news, so it is red.
  const cancelledOrders = windowOrders.data.filter((o) => o.orderStatus === 'cancelled');
  const placedNow = compareWindows(windowOrders.data, placed, now, undefined, days);
  const cancelledNow = compareWindows(cancelledOrders, placed, now, undefined, days);
  const rateOf = (cancelled: number, all: number) => (all > 0 ? Math.round((cancelled / all) * 1000) / 10 : null);
  const rateCurrent = rateOf(cancelledNow.current, placedNow.current);
  const ratePrevious = rateOf(cancelledNow.previous, placedNow.previous);
  const rateChange = rateCurrent !== null && ratePrevious !== null ? Math.round((rateCurrent - ratePrevious) * 10) / 10 : null;
  const cancelTrend =
    windowOrders.status !== 'ready'
      ? { value: windowOrders.status === 'error' ? '–' : '…', hint: undefined, tone: undefined, arrow: undefined, spark: undefined }
      : {
          value: rateCurrent === null ? '—' : `${number(rateCurrent)}%`,
          hint:
            rateChange === null
              ? t('trend.noPrevious')
              : t('trend.deltaPoints', {
                  change: `${rateChange > 0 ? '+' : rateChange < 0 ? '−' : ''}${number(Math.abs(rateChange))}`,
                  period,
                }),
          tone: rateChange === null || rateChange === 0 ? undefined : rateChange > 0 ? ('down' as const) : ('up' as const),
          // The arrow follows the figure (a lower cancel rate points down), the colour says whether that is good.
          arrow: rateChange === null || rateChange === 0 ? undefined : rateChange > 0 ? ('up' as const) : ('down' as const),
          spark: dailySeries(cancelledOrders, placed, now, days),
        };

  // The line chart: confirmed sales in each of the last `days` 24-hour slots ending at the moment the figures were read.
  const DAY_MS = 86_400_000;
  const salesPerDay = dailySeries(confirmed, placed, now, days, (o) => o.totalAmount);
  const salesTotal = salesPerDay.reduce((a, b) => a + b, 0);
  const salesPeak = Math.max(0, ...salesPerDay);

  return (
    <>
      <PageHeader
        title={firstName ? t('dashboard.greeting', { name: firstName }) : t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            {snapshot && (
              <span className="muted">{t('dashboard.updatedAt', { time: dateTime(new Date(snapshot.at)) })}</span>
            )}
            <div className="segmented" role="group" aria-label={t('dashboard.period')}>
              {PERIOD_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={d === days ? 'segmented__item segmented__item--active' : 'segmented__item'}
                  aria-pressed={d === days}
                  onClick={() => setDays(d)}
                >
                  {periodName(d)}
                </button>
              ))}
            </div>
            <button className="btn btn--sm" onClick={() => void refresh()} disabled={refreshing}>
              {t('dashboard.refresh')}
            </button>
          </>
        }
      />

      <h2 className="section-title">{t('trend.title', { period })}</h2>
      <div className="stat-grid stat-grid--trend">
        <StatCard
          icon="orders"
          to="/orders"
          label={t('trend.orders')}
          value={ordersTrend.value}
          hint={ordersTrend.hint}
          hintTone={ordersTrend.tone}
          spark={ordersTrend.spark}
        />
        <StatCard
          icon="analytics"
          to="/analytics"
          label={t('trend.sales')}
          value={salesTrend.value}
          hint={salesTrend.hint}
          hintTone={salesTrend.tone}
          spark={salesTrend.spark}
        />
        <StatCard
          icon="customers"
          to="/customers"
          label={t('trend.customers')}
          value={customersTrend.value}
          hint={customersTrend.hint}
          hintTone={customersTrend.tone}
          spark={customersTrend.spark}
        />
        <StatCard
          icon="alert"
          to="/orders?status=cancelled"
          label={t('trend.cancelRate')}
          value={cancelTrend.value}
          hint={cancelTrend.hint}
          hintTone={cancelTrend.tone}
          hintArrow={cancelTrend.arrow}
          spark={cancelTrend.spark}
        />
      </div>

      <Card title={t('dashboard.chart.title')}>
        <DataGate gates={[windowOrders]}>
          {salesTotal === 0 ? (
            <EmptyState message={t('dashboard.chart.empty')} />
          ) : (
            <LineChart
              values={salesPerDay}
              pointLabels={salesPerDay.map(
                (v, i) => `${date(new Date(now - (days - 1 - i) * DAY_MS))} — ${money(v)}`,
              )}
              formatAxis={number}
              startLabel={date(new Date(now - (days - 1) * DAY_MS))}
              endLabel={t('dashboard.chart.today')}
              summary={t('dashboard.chart.summary', { total: money(salesTotal), period, peak: money(salesPeak) })}
            />
          )}
        </DataGate>
      </Card>

      <div className="stat-grid">
        <StatCard
          icon="companies"
          to="/companies"
          label={t('kpi.totalCompanies')}
          value={total('companies')}
        />
        <StatCard
          icon="companies"
          to="/companies?status=active"
          label={t('kpi.activeCompanies')}
          value={activeCompanies === undefined ? '…' : activeCompanies === null ? '–' : number(activeCompanies)}
        />
        <StatCard
          icon="customers"
          to="/customers"
          label={t('kpi.totalCustomers')}
          value={total('customers')}
        />
        <StatCard
          icon="products"
          to="/products"
          label={t('kpi.totalProducts')}
          value={total('products')}
        />
        <StatCard
          icon="orders"
          to="/orders"
          label={t('kpi.totalOrders')}
          value={total('orders')}
        />
        <StatCard
          icon="orders"
          to="/orders?status=processing"
          label={t('kpi.processingOrders')}
          value={total('processingOrders')}
        />
        <StatCard
          icon="orders"
          to="/orders?status=completed"
          label={t('kpi.completedOrders')}
          value={total('completedOrders')}
        />
      </div>

      <div className="grid-2">
        <Card
          title={t('dashboard.recentOrders')}
          flush
          actions={
            <Link to="/orders" className="link-sm">
              {t('common.viewAll')}
            </Link>
          }
        >
          <DataGate gates={[recentOrdersGate]}>
            {recentOrders.length === 0 ? (
              <EmptyState message={t('dashboard.noOrders')} />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('col.orderId')}</th>
                      <th>{t('col.customer')}</th>
                      <th>{t('col.company')}</th>
                      <th>{t('col.total')}</th>
                      <th>{t('col.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link to={`/orders/${o.id}`} className="mono" dir="ltr">
                            #{shortId(o.id)}
                          </Link>
                        </td>
                        <td>
                          <Text>{customerLabel(o)}</Text>
                        </td>
                        <td>
                          <Text>{o.companyName || '—'}</Text>
                        </td>
                        <td className="nowrap">{money(o.totalAmount)}</td>
                        <td>
                          <OrderStatusBadge status={o.orderStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataGate>
        </Card>

        <Card
          title={t('dashboard.recentCompanies')}
          flush
          actions={
            <Link to="/companies" className="link-sm">
              {t('common.viewAll')}
            </Link>
          }
        >
          <DataGate gates={[recentCompaniesGate]}>
            {recentCompanies.length === 0 ? (
              <EmptyState message={t('dashboard.noCompanies')} />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('col.name')}</th>
                      <th>{t('col.status')}</th>
                      <th>{t('col.created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCompanies.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/companies/${c.id}`} className="cell-with-thumb">
                            <Thumb src={c.logoUrl} size={32} />
                            <Text>{c.name || '—'}</Text>
                          </Link>
                        </td>
                        <td>
                          <CompanyStatusBadge status={c.status} />
                        </td>
                        <td className="nowrap">{date(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataGate>
        </Card>
      </div>
    </>
  );
}

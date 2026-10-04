import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AttentionBanner } from '../components/AttentionBanner';
import { useRunner } from '../components/feedback';
import { SortTh, useSortedRows } from '../components/sort';
import { OrderStatusBadge, PaymentBadge } from '../components/StatusBadges';
import { Chips, EmptyState, ErrorState, LoadingState, PageHeader, SearchInput, Text } from '../components/ui';
import { ordersToCsv } from '../data/analytics';
import { csvFilename, downloadCsv } from '../data/csv';
import { useCompanies } from '../data/hooks';
import { exportOrders, usePagedOrders, useOrderStatusCounts } from '../data/orderHooks';
import { ORDER_EXPORT_MAX } from '../data/orderQueries';
import { matchesOrderAttention, ORDER_ATTENTIONS, STUCK_ORDER_DAYS, UNVERIFIED_PAYMENT_HOURS } from '../data/stats';
import { ORDER_STATUSES, type Order, type OrderStatus } from '../data/types';
import { useDashboard } from '../data/useDashboard';
import { useI18n } from '../i18n/I18nProvider';
import { customerLabel, matchesQuery, shortId } from '../utils';

const SORTS = {
  id: (o: Order) => o.id,
  customer: (o: Order) => customerLabel(o),
  company: (o: Order) => o.companyName,
  product: (o: Order) => o.productName,
  quantity: (o: Order) => o.quantity,
  total: (o: Order) => o.totalAmount,
  payment: (o: Order) => o.paymentStatus,
  status: (o: Order) => o.orderStatus,
  date: (o: Order) => o.createdAt,
};

/** A day from the address (2026-10-05) as the start or the end of that day on this computer. */
export function parseDay(value: string | null, edge: 'start' | 'end'): Date | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = edge === 'start' ? new Date(year, month - 1, day, 0, 0, 0, 0) : new Date(year, month - 1, day, 23, 59, 59, 999);
  // 2026-02-31 is not a day: the Date constructor would roll it into March.
  return date.getMonth() === month - 1 ? date : null;
}

export function OrdersPage() {
  const { t, number, money, dateTime } = useI18n();
  const companies = useCompanies();
  const { snapshot } = useDashboard();
  // The filters live in the URL so dashboard cards can link straight to the list they counted (?status=processing).
  const [params, setParams] = useSearchParams();
  const companyId = params.get('company') ?? '';
  const statusParam = params.get('status');
  const status: OrderStatus | 'all' = ORDER_STATUSES.find((s) => s === statusParam) ?? 'all';
  // ?attention=unverified|stuck narrows the list to what the dashboard flagged.
  const attentionParam = params.get('attention');
  const attention = ORDER_ATTENTIONS.find((a) => a === attentionParam) ?? null;
  const fromParam = params.get('from') ?? '';
  const toParam = params.get('to') ?? '';
  const from = parseDay(fromParam, 'start');
  const to = parseDay(toParam, 'end');
  const badRange = from !== null && to !== null && from.getTime() > to.getTime();

  const updateFilters = (next: { company?: string; status?: OrderStatus | 'all'; attention?: null; from?: string; to?: string }) => {
    const company = next.company ?? companyId;
    const nextStatus = next.status ?? status;
    const nextAttention = next.attention === null ? null : attention;
    const nextFrom = next.from ?? fromParam;
    const nextTo = next.to ?? toParam;
    setParams(
      {
        ...(company ? { company } : {}),
        ...(nextStatus !== 'all' ? { status: nextStatus } : {}),
        ...(nextAttention ? { attention: nextAttention } : {}),
        ...(nextFrom ? { from: nextFrom } : {}),
        ...(nextTo ? { to: nextTo } : {}),
      },
      { replace: true },
    );
  };
  const [query, setQuery] = useState('');
  const { busy, run } = useRunner();

  // The server sends a page at a time; the dashboard's own read answers the "needs attention" lists.
  const paged = usePagedOrders(
    { status: status === 'all' ? null : status, companyId: companyId || null, from, to },
    !attention && !badRange,
  );
  // The counts are read again each time the live list changes.
  const counts = useOrderStatusCounts({ companyId: companyId || null, from, to }, !attention && !badRange, paged.changes);

  const flagged: Order[] =
    attention && snapshot && snapshot.openOrders.ok
      ? snapshot.openOrders.value.filter((o) => matchesOrderAttention(o, attention, snapshot.at))
      : [];

  // In an attention list the company and date filters apply here, on the few rows it has.
  const base: Order[] = attention
    ? flagged.filter(
        (o) =>
          (!companyId || o.companyId === companyId) &&
          (!from || (o.createdAt !== null && o.createdAt >= from)) &&
          (!to || (o.createdAt !== null && o.createdAt <= to)),
      )
    : paged.orders;
  const rows = attention ? base.filter((o) => status === 'all' || o.orderStatus === status) : base;
  const visible = rows.filter((o) => matchesQuery(query, o.id, customerLabel(o), o.companyName, o.productName));
  const { rows: sortedRows, sort, toggle } = useSortedRows(visible, SORTS);

  const statusCount = (s: OrderStatus): number | undefined =>
    attention ? base.filter((o) => o.orderStatus === s).length : counts?.[s];
  const allCount = attention
    ? base.length
    : counts
      ? ORDER_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0)
      : undefined;
  const total = status === 'all' ? allCount : statusCount(status);

  const phase = badRange
    ? 'ready'
    : attention
      ? !snapshot
        ? 'loading'
        : snapshot.openOrders.ok
          ? 'ready'
          : 'error'
      : paged.status;
  // The file holds every order the filters match (read in pages, up to a cap), not only the ones loaded on screen.
  const exportCsv = () =>
    run(
      'export',
      async () => {
        const result = attention
          ? { orders: visible, capped: false }
          : await exportOrders({ status: status === 'all' ? null : status, companyId: companyId || null, from, to });
        downloadCsv(csvFilename('orders', Date.now()), ordersToCsv(result.orders));
        return result;
      },
      (result) => (result.capped ? t('orders.exportCapped', { n: number(result.orders.length) }) : t('orders.exported', { n: number(result.orders.length) })),
    ).then(() => undefined);
  const hasFilters = status !== 'all' || companyId !== '' || fromParam !== '' || toParam !== '' || attention !== null;

  return (
    <>
      <PageHeader
        title={t('orders.title')}
        subtitle={t('orders.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <>
            <button
              className="btn btn--sm"
              disabled={busy === 'export' || badRange || (attention ? visible.length === 0 : paged.status !== 'ready')}
              title={t('orders.exportHint', { max: number(ORDER_EXPORT_MAX) })}
              onClick={() => void exportCsv()}
            >
              {busy === 'export' ? t('orders.exporting') : t('common.exportCsv')}
            </button>
          </>
        }
      />
      {attention && (
        <AttentionBanner
          label={
            attention === 'unverified'
              ? t('attention.unverified', { hours: UNVERIFIED_PAYMENT_HOURS })
              : t('attention.stuck', { days: STUCK_ORDER_DAYS })
          }
          onClear={() => updateFilters({ attention: null })}
        />
      )}
      <div className="toolbar">
        <Chips
          value={status}
          onChange={(next) => updateFilters({ status: next })}
          options={[
            { value: 'all', label: t('common.all'), count: allCount },
            ...ORDER_STATUSES.map((s) => ({ value: s, label: t(`order.status.${s}`), count: statusCount(s) })),
          ]}
        />
        <div className="toolbar__end">
          <select
            className="select"
            value={companyId}
            aria-label={t('col.company')}
            onChange={(e) => updateFilters({ company: e.target.value })}
          >
            <option value="">{t('products.allCompanies')}</option>
            {companies.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <SearchInput value={query} onChange={setQuery} placeholder={t('orders.search')} />
        </div>
      </div>
      <div className="toolbar">
        <div className="toolbar__end">
          <label className="inline-field">
            <span>{t('orders.from')}</span>
            <input type="date" value={fromParam} max={toParam || undefined} onChange={(e) => updateFilters({ from: e.target.value })} />
          </label>
          <label className="inline-field">
            <span>{t('orders.to')}</span>
            <input type="date" value={toParam} min={fromParam || undefined} onChange={(e) => updateFilters({ to: e.target.value })} />
          </label>
          {(fromParam || toParam) && (
            <button className="btn btn--ghost btn--sm" onClick={() => updateFilters({ from: '', to: '' })}>
              {t('orders.clearDates')}
            </button>
          )}
        </div>
        <p className="muted toolbar__note">{t('orders.searchHint')}</p>
      </div>

      {badRange ? (
        <p className="field__error" role="alert">
          {t('orders.badRange')}
        </p>
      ) : phase === 'loading' ? (
        <LoadingState />
      ) : phase === 'error' ? (
        <ErrorState
          // A list that needs an index the server is still building says so, instead of a plain failure.
          message={(paged.error as { code?: string } | null)?.code === 'failed-precondition' ? t('error.indexBuilding') : t('error.load')}
          onRetry={attention ? undefined : paged.retry}
        />
      ) : rows.length === 0 && !hasFilters ? (
        <EmptyState message={t('orders.empty')} />
      ) : visible.length === 0 ? (
        <EmptyState message={t('common.noResults')} />
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <SortTh label={t('col.orderId')} sortKey="id" sort={sort} onSort={toggle} />
                  <SortTh label={t('col.customer')} sortKey="customer" sort={sort} onSort={toggle} />
                  <SortTh label={t('col.company')} sortKey="company" sort={sort} onSort={toggle} />
                  <SortTh label={t('col.product')} sortKey="product" sort={sort} onSort={toggle} />
                  <SortTh label={t('col.quantity')} sortKey="quantity" sort={sort} onSort={toggle} />
                  <SortTh label={t('col.total')} sortKey="total" sort={sort} onSort={toggle} />
                  <SortTh label={t('col.payment')} sortKey="payment" sort={sort} onSort={toggle} />
                  <SortTh label={t('col.orderStatus')} sortKey="status" sort={sort} onSort={toggle} />
                  <SortTh label={t('col.date')} sortKey="date" sort={sort} onSort={toggle} />
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((o) => (
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
                    <td>
                      <Text>{o.productName || '—'}</Text>
                    </td>
                    <td>{number(o.quantity)}</td>
                    <td className="nowrap">{money(o.totalAmount)}</td>
                    <td>
                      <PaymentBadge status={o.paymentStatus} orderStatus={o.orderStatus} />
                    </td>
                    <td>
                      <OrderStatusBadge status={o.orderStatus} />
                    </td>
                    <td className="nowrap">{dateTime(o.createdAt)}</td>
                    <td>
                      <Link to={`/orders/${o.id}`} className="btn btn--sm">
                        {t('common.view')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card__foot card__foot--between">
            <span className="muted">
              {total !== undefined && !attention
                ? t('orders.showing', { shown: number(rows.length), total: number(total) })
                : t('orders.showingOnly', { shown: number(rows.length) })}
            </span>
            {!attention && paged.hasMore && (
              <button className="btn btn--sm" onClick={paged.loadMore} disabled={paged.loadingMore}>
                {paged.loadingMore ? t('common.loading') : t('orders.loadMore')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

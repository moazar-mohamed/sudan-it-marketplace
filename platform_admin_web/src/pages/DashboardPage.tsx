import { Link } from 'react-router-dom';
import { CompanyStatusBadge, OrderStatusBadge } from '../components/StatusBadges';
import { Card, DataGate, EmptyState, PageHeader, StatCard, Text, Thumb } from '../components/ui';
import { useCompanies, useCustomers, useOrders, useProducts } from '../data/hooks';
import { countActiveCompanies, countOrdersWithStatus } from '../data/stats';
import { useI18n } from '../i18n/I18nProvider';
import { customerLabel, shortId } from '../utils';

export function DashboardPage() {
  const { t, number, money, date } = useI18n();
  const companies = useCompanies();
  const customers = useCustomers();
  const products = useProducts();
  const orders = useOrders();

  // Each figure reflects its own collection so one failing source does not
  // hide the others: "…" while loading, "–" if it could not be loaded.
  const figure = (
    state: { status: 'loading' | 'ready' | 'error' },
    compute: () => number,
  ) => (state.status === 'ready' ? number(compute()) : state.status === 'error' ? '–' : '…');

  const recentCompanies = [...companies.data]
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 5);
  const recentOrders = orders.data.slice(0, 5);

  return (
    <>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      <div className="stat-grid">
        <StatCard
          icon="companies"
          to="/companies"
          label={t('kpi.totalCompanies')}
          value={figure(companies, () => companies.data.length)}
        />
        <StatCard
          icon="companies"
          to="/companies?status=active"
          label={t('kpi.activeCompanies')}
          value={figure(companies, () => countActiveCompanies(companies.data))}
        />
        <StatCard
          icon="customers"
          to="/customers"
          label={t('kpi.totalCustomers')}
          value={figure(customers, () => customers.data.length)}
        />
        <StatCard
          icon="products"
          to="/products"
          label={t('kpi.totalProducts')}
          value={figure(products, () => products.data.length)}
        />
        <StatCard
          icon="orders"
          to="/orders"
          label={t('kpi.totalOrders')}
          value={figure(orders, () => orders.data.length)}
        />
        <StatCard
          icon="orders"
          to="/orders?status=processing"
          label={t('kpi.processingOrders')}
          value={figure(orders, () => countOrdersWithStatus(orders.data, 'processing'))}
        />
        <StatCard
          icon="orders"
          to="/orders?status=completed"
          label={t('kpi.completedOrders')}
          value={figure(orders, () => countOrdersWithStatus(orders.data, 'completed'))}
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
          <DataGate gates={[orders]}>
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
          <DataGate gates={[companies]}>
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

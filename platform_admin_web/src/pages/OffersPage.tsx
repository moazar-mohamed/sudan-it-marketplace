import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm, useRunner } from '../components/feedback';
import { SortTh, useSortedRows } from '../components/sort';
import { Card, DataGate, EmptyState, PageHeader, SearchInput, Text, Thumb } from '../components/ui';
import { endProductOffer, endServiceOffer } from '../data/actions';
import { useCompanies, useCompanyServices, useProducts, useServices } from '../data/hooks';
import { isOfferRunning } from '../data/stats';
import type { CompanyServiceLink, Product } from '../data/types';
import { useNow } from '../data/useNow';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery } from '../utils';

const PRODUCT_SORTS = {
  item: (p: Product) => p.name,
  company: (p: Product) => p.companyName,
  normal: (p: Product) => p.price,
  offer: (p: Product) => p.offerPrice,
  ends: (p: Product) => p.offerEndsAt,
};

interface ServiceOffer {
  link: CompanyServiceLink;
  service: string;
  company: string;
}

const SERVICE_SORTS = {
  item: (o: ServiceOffer) => o.service,
  company: (o: ServiceOffer) => o.company,
  normal: (o: ServiceOffer) => o.link.price,
  offer: (o: ServiceOffer) => o.link.offerPrice,
  ends: (o: ServiceOffer) => o.link.offerEndsAt,
};

/** Every offer running now, on a product or on a service, with the one action Platform Admin has on it: end it. */
export function OffersPage() {
  const { t, money, dateTime } = useI18n();
  const products = useProducts();
  const links = useCompanyServices();
  const services = useServices();
  const companies = useCompanies();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const now = useNow();
  const [query, setQuery] = useState('');

  const productOffers = useMemo(
    () =>
      products.data
        .filter((p) => isOfferRunning(p, now))
        .filter((p) => matchesQuery(query, p.name, p.companyName)),
    [products.data, now, query],
  );

  const serviceOffers = useMemo(() => {
    const serviceName = new Map(services.data.map((s) => [s.id, s.name]));
    const companyName = new Map(companies.data.map((c) => [c.id, c.name]));
    return links.data
      .filter((l) => isOfferRunning(l, now))
      .map((l) => ({
        link: l,
        service: serviceName.get(l.serviceId) ?? l.serviceId,
        company: companyName.get(l.companyId) ?? l.companyId,
      }))
      .filter((o) => matchesQuery(query, o.service, o.company));
  }, [links.data, services.data, companies.data, now, query]);

  const productRows = useSortedRows(productOffers, PRODUCT_SORTS);
  const serviceRows = useSortedRows(serviceOffers, SERVICE_SORTS);

  const endOffer = async (key: string, name: string, action: () => Promise<void>) => {
    const ok = await confirm({
      title: t('offers.endService.title'),
      body: t('offers.endService.body', { name }),
      confirmLabel: t('offers.end'),
      danger: true,
    });
    if (ok) await run(key, action, t('offers.endService.done'));
  };

  const ends = (date: Date | null) => (date ? dateTime(date) : t('offers.noEnd'));

  return (
    <>
      <PageHeader title={t('offers.title')} subtitle={t('offers.subtitle')} back={{ to: '/', label: t('nav.dashboard') }} />
      <DataGate gates={[products, links, services, companies]}>
        <div className="toolbar">
          <div className="toolbar__end">
            <SearchInput value={query} onChange={setQuery} placeholder={t('offers.search')} />
          </div>
        </div>

        <Card title={t('offers.products')} flush>
          {productOffers.length === 0 ? (
            <EmptyState message={t('offers.empty')} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label={t('offers.col.item')} sortKey="item" sort={productRows.sort} onSort={productRows.toggle} />
                    <SortTh label={t('col.company')} sortKey="company" sort={productRows.sort} onSort={productRows.toggle} />
                    <SortTh label={t('offers.col.normal')} sortKey="normal" sort={productRows.sort} onSort={productRows.toggle} />
                    <SortTh label={t('offers.col.offer')} sortKey="offer" sort={productRows.sort} onSort={productRows.toggle} />
                    <SortTh label={t('offers.col.ends')} sortKey="ends" sort={productRows.sort} onSort={productRows.toggle} />
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/products/${p.id}`} className="cell-with-thumb">
                          <Thumb src={p.imageUrl} size={32} />
                          <Text>{p.name}</Text>
                        </Link>
                      </td>
                      <td>
                        <Text>{p.companyName || '—'}</Text>
                      </td>
                      <td className="nowrap">{p.price === null ? '—' : money(p.price, p.currency)}</td>
                      <td className="nowrap">{p.offerPrice === null ? '—' : money(p.offerPrice, p.currency)}</td>
                      <td className="nowrap">{ends(p.offerEndsAt)}</td>
                      <td>
                        <button
                          className="btn btn--danger-ghost btn--sm"
                          disabled={busy === `product-${p.id}`}
                          onClick={() => void endOffer(`product-${p.id}`, p.name, () => endProductOffer(p))}
                        >
                          {t('offers.end')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={t('offers.services')} flush>
          {serviceOffers.length === 0 ? (
            <EmptyState message={t('offers.empty')} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label={t('offers.col.item')} sortKey="item" sort={serviceRows.sort} onSort={serviceRows.toggle} />
                    <SortTh label={t('col.company')} sortKey="company" sort={serviceRows.sort} onSort={serviceRows.toggle} />
                    <SortTh label={t('offers.col.normal')} sortKey="normal" sort={serviceRows.sort} onSort={serviceRows.toggle} />
                    <SortTh label={t('offers.col.offer')} sortKey="offer" sort={serviceRows.sort} onSort={serviceRows.toggle} />
                    <SortTh label={t('offers.col.ends')} sortKey="ends" sort={serviceRows.sort} onSort={serviceRows.toggle} />
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.rows.map(({ link, service, company }) => (
                    <tr key={link.id}>
                      <td>
                        <Text>{service}</Text>
                      </td>
                      <td>
                        <Link to={`/companies/${link.companyId}`}>
                          <Text>{company}</Text>
                        </Link>
                      </td>
                      <td className="nowrap">{link.price === null ? '—' : money(link.price)}</td>
                      <td className="nowrap">{link.offerPrice === null ? '—' : money(link.offerPrice)}</td>
                      <td className="nowrap">{ends(link.offerEndsAt)}</td>
                      <td>
                        <button
                          className="btn btn--danger-ghost btn--sm"
                          disabled={busy === `service-${link.id}`}
                          onClick={() =>
                            void endOffer(`service-${link.id}`, `${service} — ${company}`, () =>
                              endServiceOffer(link, `${service} — ${company}`),
                            )
                          }
                        >
                          {t('offers.end')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </DataGate>
    </>
  );
}

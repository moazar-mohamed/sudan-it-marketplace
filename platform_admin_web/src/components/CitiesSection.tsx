import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCities } from '../data/cities';
import { companiesServing, companiesWithoutCities, fetchCityCustomerCounts, type CityCustomerCounts } from '../data/cityStats';
import { useCompanies } from '../data/hooks';
import { db } from '../firebase';
import { useI18n } from '../i18n/I18nProvider';
import { Card } from './ui';

/**
 * Where the customers and the companies are, city by city. A city with
 * customers but no company serving it is where new companies are needed.
 */
export function CitiesSection() {
  const { t, number, locale } = useI18n();
  const companies = useCompanies();
  const cities = useCities();
  const [counts, setCounts] = useState<CityCustomerCounts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCityCustomerCounts(db, cities).then(
      (value) => {
        if (!cancelled) setCounts(value);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cities]);

  const withoutCities = companiesWithoutCities(companies.data);
  const rows = cities.map((city) => ({
    id: city.id,
    name: locale === 'ar' ? city.ar : city.en,
    customers: counts?.byCity[city.id] ?? 0,
    companies: companiesServing(companies.data, city.id),
    active: city.active,
  }))
    .filter((row) => row.active || row.customers > 0)
    .sort((a, b) => b.customers - a.customers);

  return (
    <Card title={t('analytics.cities.title')}>
      {failed ? (
        <p className="field__error" role="alert">
          {t('analytics.cities.failed')}
        </p>
      ) : (
        <>
          <p className="note">
            {t('analytics.cities.note')}{' '}
            {withoutCities > 0 && (
              <Link to="/companies?cities=none">{t('analytics.cities.withoutCities', { count: number(withoutCities) })}</Link>
            )}
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('company.city')}</th>
                  <th>{t('analytics.cities.customers')}</th>
                  <th>{t('analytics.cities.companies')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={counts && row.customers > 0 && row.companies === 0 ? 'row--warn' : undefined}>
                    <td>{row.name}</td>
                    <td>{counts ? number(row.customers) : '…'}</td>
                    <td>{number(row.companies)}</td>
                  </tr>
                ))}
                {counts && (
                  <tr>
                    <td>{t('analytics.cities.noCity')}</td>
                    <td>{number(counts.noCity)}</td>
                    <td>—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

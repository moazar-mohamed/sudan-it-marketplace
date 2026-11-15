import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Bits';
import { usePageTitle } from '../data/pageTitle';
import { t } from '../i18n';

/** An address the site doesn't have: say so, and offer the main places instead of a silent jump home. */
export function NotFoundPage() {
  usePageTitle(t('الصفحة غير موجودة'));
  return (
    <main className="stack">
      <EmptyState title={t('الصفحة غير موجودة')} message={t('ربما تغيّر الرابط أو حُذفت الصفحة. جرّب إحدى هذه:')}>
        <div className="not-found-links">
          <Link to="/" className="pill">{t('الرئيسية')}</Link>
          <Link to="/browse?kind=products" className="pill">{t('المنتجات')}</Link>
          <Link to="/browse?kind=services" className="pill">{t('الخدمات')}</Link>
          <Link to="/search" className="pill">{t('بحث')}</Link>
        </div>
      </EmptyState>
    </main>
  );
}

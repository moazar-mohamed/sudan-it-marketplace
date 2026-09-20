import { Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { EmptyState } from './components/ui';
import { useI18n } from './i18n/I18nProvider';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailsPage } from './pages/CompanyDetailsPage';
import { CustomerDetailsPage } from './pages/CustomerDetailsPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OrderDetailsPage } from './pages/OrderDetailsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const { t } = useI18n();
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <div className="fullscreen-state" role="status">
        <span className="spinner" aria-hidden="true" />
        <p className="muted">{t('login.verifying')}</p>
      </div>
    );
  }

  // Only a signed-in, active platform_admin ever reaches the routes below.
  if (state.status === 'signedOut') {
    return <LoginPage notice={state.notice} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:id" element={<CompanyDetailsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<EmptyState message={t('common.notFound')} />} />
      </Route>
    </Routes>
  );
}

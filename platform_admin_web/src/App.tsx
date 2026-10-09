import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { EmptyState } from './components/ui';
import { useI18n } from './i18n/I18nProvider';
import { LoginPage } from './pages/LoginPage';

// Each page is its own file, fetched when it is first opened, so the first screen loads fast.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const AdminsPage = page(() => import('./pages/AdminsPage'), 'AdminsPage');
const ActivityPage = page(() => import('./pages/ActivityPage'), 'ActivityPage');
const AnalyticsPage = page(() => import('./pages/AnalyticsPage'), 'AnalyticsPage');
const CitiesPage = page(() => import('./pages/CitiesPage'), 'CitiesPage');
const CategoriesPage = page(() => import('./pages/CategoriesPage'), 'CategoriesPage');
const ServicesPage = page(() => import('./pages/ServicesPage'), 'ServicesPage');
const ServiceRequestDetailsPage = page(() => import('./pages/ServiceRequestDetailsPage'), 'ServiceRequestDetailsPage');
const ServiceRequestsPage = page(() => import('./pages/ServiceRequestsPage'), 'ServiceRequestsPage');
const CompaniesPage = page(() => import('./pages/CompaniesPage'), 'CompaniesPage');
const CompanyDetailsPage = page(() => import('./pages/CompanyDetailsPage'), 'CompanyDetailsPage');
const CustomerDetailsPage = page(() => import('./pages/CustomerDetailsPage'), 'CustomerDetailsPage');
const CustomersPage = page(() => import('./pages/CustomersPage'), 'CustomersPage');
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage');
const OffersPage = page(() => import('./pages/OffersPage'), 'OffersPage');
const OrderDetailsPage = page(() => import('./pages/OrderDetailsPage'), 'OrderDetailsPage');
const OrdersPage = page(() => import('./pages/OrdersPage'), 'OrdersPage');
const ProductDetailsPage = page(() => import('./pages/ProductDetailsPage'), 'ProductDetailsPage');
const ProductsPage = page(() => import('./pages/ProductsPage'), 'ProductsPage');
const ProfilePage = page(() => import('./pages/ProfilePage'), 'ProfilePage');
const ReportsPage = page(() => import('./pages/ReportsPage'), 'ReportsPage');
const ReviewsPage = page(() => import('./pages/ReviewsPage'), 'ReviewsPage');
const TrashPage = page(() => import('./pages/TrashPage'), 'TrashPage');
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage');

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
        <Route path="services" element={<ServicesPage />} />
        <Route path="service-requests" element={<ServiceRequestsPage />} />
        <Route path="service-requests/:id" element={<ServiceRequestDetailsPage />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="cities" element={<CitiesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="admins" element={<AdminsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="trash" element={<TrashPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<EmptyState message={t('common.notFound')} />} />
      </Route>
    </Routes>
  );
}

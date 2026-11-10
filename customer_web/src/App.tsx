import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AccountGate } from './components/AccountGate';
import { AutoUpdate } from './components/AutoUpdate';
import { NoticeGate } from './components/NoticeGate';
import { RequireAccount, SignedOutOnly } from './components/RequireAccount';
import { Shell } from './components/Shell';
import { CompareProvider } from './data/compare';
import { CatalogProvider } from './data/DataProvider';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';

// Each page loads when it is opened, so a first visit downloads little.
const BrowsePage = lazy(() => import('./pages/BrowsePage').then((m) => ({ default: m.BrowsePage })));
const ChatsPage = lazy(() => import('./pages/ChatsPage').then((m) => ({ default: m.ChatsPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then((m) => ({ default: m.ComparePage })));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage').then((m) => ({ default: m.CompaniesPage })));
const CompanyPage = lazy(() => import('./pages/CompanyPage').then((m) => ({ default: m.CompanyPage })));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const OrderDetailsPage = lazy(() => import('./pages/OrderDetailsPage').then((m) => ({ default: m.OrderDetailsPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const ProductPage = lazy(() => import('./pages/ProductPage').then((m) => ({ default: m.ProductPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const MyReportsPage = lazy(() => import('./pages/ReportsPages').then((m) => ({ default: m.MyReportsPage })));
const ReportFormPage = lazy(() => import('./pages/ReportsPages').then((m) => ({ default: m.ReportFormPage })));
const RequestDetailsPage = lazy(() => import('./pages/RequestDetailsPage').then((m) => ({ default: m.RequestDetailsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })));
const ServicePage = lazy(() => import('./pages/ServicePage').then((m) => ({ default: m.ServicePage })));
const ServiceRequestPage = lazy(() => import('./pages/ServiceRequestPage').then((m) => ({ default: m.ServiceRequestPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

/**
 * The whole site for everyone: browsing needs no account. Only the pages under
 * RequireAccount (checkout, orders, chats...) ask a visitor to sign in, and
 * bring them back to the same page afterwards.
 */
function SiteRoutes() {
  return (
    <CompareProvider>
      <Routes>
        <Route path="login" element={<SignedOutOnly><LoginPage /></SignedOutOnly>} />
        <Route path="register" element={<SignedOutOnly><Suspense fallback={null}><RegisterPage /></Suspense></SignedOutOnly>} />
        <Route path="forgot-password" element={<SignedOutOnly><Suspense fallback={null}><ForgotPasswordPage /></Suspense></SignedOutOnly>} />
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="category/:id" element={<BrowsePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="product/:id" element={<ProductPage />} />
          <Route path="company/:id" element={<CompanyPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="service/:id" element={<ServicePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route element={<RequireAccount />}>
            <Route path="profile" element={<ProfilePage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="reports" element={<MyReportsPage />} />
            <Route path="reports/new" element={<ReportFormPage />} />
            <Route path="checkout/:id" element={<CheckoutPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailsPage />} />
            <Route path="chats" element={<ChatsPage />} />
            <Route path="chats/:id" element={<ChatsPage />} />
            <Route path="service-request" element={<ServiceRequestPage />} />
            <Route path="requests/:id" element={<RequestDetailsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CompareProvider>
  );
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return (
    <BrowserRouter>
      <AutoUpdate />
      <NoticeGate>
        {user ? (
          <AccountGate>
            <SiteRoutes />
          </AccountGate>
        ) : (
          <CatalogProvider profile={null}>
            <SiteRoutes />
          </CatalogProvider>
        )}
      </NoticeGate>
    </BrowserRouter>
  );
}

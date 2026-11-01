import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AccountGate } from './components/AccountGate';
import { Shell } from './components/Shell';
import { BrowsePage } from './pages/BrowsePage';
import { CheckoutPage } from './pages/CheckoutPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyPage } from './pages/CompanyPage';
import { ComingSoon } from './pages/ComingSoon';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OrderDetailsPage } from './pages/OrderDetailsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductPage } from './pages/ProductPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { MyReportsPage, ReportFormPage } from './pages/ReportsPages';
import { SearchPage } from './pages/SearchPage';
import { ServicePage } from './pages/ServicePage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return (
    <BrowserRouter>
      {user ? (
        <AccountGate>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<HomePage />} />
              <Route path="browse" element={<BrowsePage />} />
              <Route path="category/:id" element={<BrowsePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="product/:id" element={<ProductPage />} />
              <Route path="company/:id" element={<CompanyPage />} />
              <Route path="companies" element={<CompaniesPage />} />
              <Route path="service/:id" element={<ServicePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="reports" element={<MyReportsPage />} />
              <Route path="reports/new" element={<ReportFormPage />} />
              <Route path="checkout/:id" element={<CheckoutPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailsPage />} />
              <Route path="chats" element={<ComingSoon title="المحادثات" />} />
              <Route path="chats/:id" element={<ComingSoon title="المحادثة" />} />
              <Route path="service-request" element={<ComingSoon title="اطلب الخدمة" />} />
              <Route path="requests/:id" element={<ComingSoon title="طلب الخدمة" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AccountGate>
      ) : (
        <Routes>
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

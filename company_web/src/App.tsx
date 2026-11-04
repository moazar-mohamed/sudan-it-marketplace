import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { CompanyDataProvider } from './data/CompanyData';
import { ForcePasswordPage } from './pages/ForcePasswordPage';
import { LoginPage } from './pages/LoginPage';
import { Empty, Loading } from './ui/kit';
import { Shell } from './ui/Shell';

// Each page is its own file, fetched when it is first opened.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const TodayPage = page(() => import('./pages/TodayPage'), 'TodayPage');
const OrdersPage = page(() => import('./pages/OrdersPage'), 'OrdersPage');
const OrderDetailsPage = page(() => import('./pages/OrderDetailsPage'), 'OrderDetailsPage');
const ProductsPage = page(() => import('./pages/ProductsPage'), 'ProductsPage');
const ProductEditPage = page(() => import('./pages/ProductEditPage'), 'ProductEditPage');
const OffersPage = page(() => import('./pages/OffersPage'), 'OffersPage');
const ServicesPage = page(() => import('./pages/ServicesPage'), 'ServicesPage');
const CompanyPage = page(() => import('./pages/CompanyPage'), 'CompanyPage');
const TeamPage = page(() => import('./pages/TeamPage'), 'TeamPage');
const ChatsPage = page(() => import('./pages/ChatsPage'), 'ChatsPage');
const NotificationsPage = page(() => import('./pages/NotificationsPage'), 'NotificationsPage');

export default function App() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <Loading text="جارٍ التحقق من الحساب…" />;
  }
  if (state.status === 'signedOut') {
    return <LoginPage notice={state.notice} />;
  }
  if (state.profile.mustChangePassword) {
    return <ForcePasswordPage />;
  }

  return (
    <CompanyDataProvider companyId={state.profile.companyId}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<TodayPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductEditPage />} />
            <Route path="products/:id" element={<ProductEditPage />} />
            <Route path="offers" element={<OffersPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="company" element={<CompanyPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="chats" element={<ChatsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="*" element={<Empty text="الصفحة غير موجودة" />} />
          </Route>
        </Routes>
      </Suspense>
    </CompanyDataProvider>
  );
}

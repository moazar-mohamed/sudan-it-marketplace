import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { TechDataProvider, useTechData } from './data/TechData';
import { listenForPushOpens, refreshPush } from './data/webPush';
import { t } from './i18n';
import LoginPage from './pages/LoginPage';
import PasswordPage from './pages/PasswordPage';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { Loading, Tabs } from './ui/kit';
import HomePage from './pages/HomePage';

import JobsPage from './pages/JobsPage';
import JobPage from './pages/JobPage';
import DonePage from './pages/DonePage';
import ChatsPage from './pages/ChatsPage';
import ChatPage from './pages/ChatPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const { state } = useAuth();
  if (state.status === 'loading') {
    return (
      <div className="app">
        <Loading />
      </div>
    );
  }
  if (state.status === 'signedOut') return <LoginPage notice={state.notice} />;
  if (state.profile.mustChangePassword) return <PasswordPage mode="first" />;
  return (
    <TechDataProvider>
      <Portal />
    </TechDataProvider>
  );
}

/** A page with the four tabs under it. */
function WithTabs({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      {children}
      <Tabs />
    </div>
  );
}

function Portal() {
  const { technician, technicianReady } = useTechData();
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const uid = state.status === 'authorized' ? state.profile.uid : '';

  // Every page is in the first download: the portal opens offline from the copy the browser kept.
  // A pressed push moves this tab to its page; pushes stay registered on each visit.
  useEffect(() => listenForPushOpens((path) => navigate(path)), [navigate]);
  useEffect(() => {
    if (uid) void refreshPush(uid);
  }, [uid]);

  if (!technicianReady) {
    return (
      <div className="app">
        <Loading />
      </div>
    );
  }
  if (!technician || !technician.isActive) {
    return (
      <div className="app">
        <div className="center">
          <h1 style={{ fontSize: 18, color: 'var(--text)' }}>{!technician ? t('لم نجد سجلك كفني في شركتك') : t('أوقفت شركتك حسابك كفني')}</h1>
          <p>{t('تواصل مع شركتك لتفعيل حسابك، ثم ادخل من جديد.')}</p>
          <button type="button" className="btn-line" style={{ minWidth: 200 }} onClick={() => void signOut()}>
            {t('تسجيل الخروج')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<WithTabs><HomePage /></WithTabs>} />
          <Route path="/jobs" element={<WithTabs><JobsPage /></WithTabs>} />
          <Route path="/jobs/:id" element={<JobPage />} />
          <Route path="/jobs/:id/done" element={<DonePage />} />
          <Route path="/chats" element={<WithTabs><ChatsPage /></WithTabs>} />
          <Route path="/chats/:id" element={<ChatPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<WithTabs><ProfilePage /></WithTabs>} />
          <Route path="/profile/password" element={<PasswordPage mode="change" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </ErrorBoundary>
  );
}

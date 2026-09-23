import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';
import { useChangeLanguage } from '../i18n/useChangeLanguage';
import { Icon, type IconName } from './Icon';

const NAV: { to: string; key: TranslationKey; icon: IconName; end?: boolean }[] = [
  { to: '/', key: 'nav.dashboard', icon: 'dashboard', end: true },
  { to: '/companies', key: 'nav.companies', icon: 'companies' },
  { to: '/customers', key: 'nav.customers', icon: 'customers' },
  { to: '/products', key: 'nav.products', icon: 'products' },
  { to: '/orders', key: 'nav.orders', icon: 'orders' },
  { to: '/service-requests', key: 'nav.serviceRequests', icon: 'serviceRequests' },
  { to: '/categories', key: 'nav.categories', icon: 'categories' },
  { to: '/services', key: 'nav.services', icon: 'services' },
  { to: '/reviews', key: 'nav.reviews', icon: 'reviews' },
  { to: '/analytics', key: 'nav.analytics', icon: 'analytics' },
  { to: '/profile', key: 'nav.profile', icon: 'profile' },
  { to: '/settings', key: 'nav.settings', icon: 'settings' },
];

export function LanguageToggle() {
  const { locale, t } = useI18n();
  const changeLanguage = useChangeLanguage();
  return (
    <button
      className="btn btn--ghost btn--sm"
      onClick={() => void changeLanguage(locale === 'ar' ? 'en' : 'ar')}
      aria-label={t('common.language')}
      title={t('common.language')}
    >
      <Icon name="globe" size={16} /> {locale === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}

export function Layout() {
  const { t } = useI18n();
  const { state, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  const profile = state.status === 'authorized' ? state.profile : null;

  return (
    <div className="app">
      <aside className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'}>
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <Icon name="companies" size={20} />
          </span>
          <div>
            <strong>{t('app.name')}</strong>
            <small>{t('app.role')}</small>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label={t('common.menu')}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} size={18} />
              <span>{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>
        <button className="nav-link nav-link--signout" onClick={() => void signOut()}>
          <Icon name="logout" size={18} />
          <span>{t('common.signOut')}</span>
        </button>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn topbar__menu"
            onClick={() => setMenuOpen(true)}
            aria-label={t('common.menu')}
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="topbar__title">{current ? t(current.key) : t('app.name')}</span>
          <div className="topbar__end">
            <LanguageToggle />
            <Link
              to="/settings"
              className="icon-btn"
              aria-label={t('nav.settings')}
              title={t('nav.settings')}
            >
              <Icon name="settings" size={18} />
            </Link>
            {profile && (
              <div className="userchip">
                <span className="userchip__avatar">
                  {(profile.fullName || profile.email || 'A').charAt(0).toUpperCase()}
                </span>
                <span className="userchip__text">
                  <bdi>{profile.fullName || profile.email}</bdi>
                  <small>{t('app.role')}</small>
                </span>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

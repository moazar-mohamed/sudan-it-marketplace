import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { attentionCounts, sumCounts } from '../data/attention';
import { useNewReports } from '../data/hooks';
import { DashboardProvider } from '../data/DashboardProvider';
import { useDashboard } from '../data/useDashboard';
import { useI18n } from '../i18n/I18nProvider';
import { useChangeLanguage } from '../i18n/useChangeLanguage';
import { watchTables } from '../ui/tableLabels';
import { AlertsBell } from './AlertsBell';
import { CommandPalette } from './CommandPalette';
import { Icon } from './Icon';
import { NAV, NAV_GROUPS, type NavItem } from './navItems';
import { LoadingState } from './ui';
import { useAttentionAlerts } from './useAttentionAlerts';

/** What a phone keeps one tap away in the bottom bar; everything else is under "More". */
const TABBAR: NavItem[] = NAV.filter((n) => ['/', '/orders', '/service-requests', '/companies'].includes(n.to));

const COLLAPSED_KEY = 'platform_admin_sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

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

/** The figures are read once for the whole signed-in shell: the Dashboard page and the sidebar badges share them. */
export function Layout() {
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  );
}

function Shell() {
  const { t, number } = useI18n();
  const { snapshot } = useDashboard();
  const newReportsNow = useNewReports();
  useAttentionAlerts(snapshot, newReportsNow.status === 'ready' ? newReportsNow.data.length : null);
  const { state, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  // Lets the stylesheet show tables as labelled cards on a phone.
  useEffect(() => (contentRef.current ? watchTables(contentRef.current) : undefined), []);

  // Ctrl+K (Cmd+K) opens the search from anywhere; "/" does too when no field is being typed in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((open) => !open);
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The phone menu closes with Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // The choice just won't persist.
    }
  }, [collapsed]);
  const toggleCollapsed = useCallback(() => setCollapsed((was) => !was), []);

  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  const profile = state.status === 'authorized' ? state.profile : null;

  // How many records each section has that need attention (see the dashboard).
  const newReports = newReportsNow;
  const found = snapshot ? attentionCounts(snapshot) : null;
  const badges: Record<string, number | null | undefined> = found
    ? {
        '/orders': sumCounts(found.unverified, found.stuck),
        '/service-requests': found.staleRequests,
        '/reviews': found.lowReviews,
        '/companies': found.noProducts,
      }
    : {};
  // New reports are counted on their own: a short live list of only the ones nobody has started on.
  if (newReports.status === 'ready' && newReports.data.length > 0) badges['/reports'] = newReports.data.length;

  const badge = (to: string) => {
    const count = badges[to] ?? 0;
    return count ? (
      <span className="nav-badge" role="img" aria-label={t('nav.attentionCount', { count: number(count) })}>
        {count > 99 ? '99+' : number(count)}
      </span>
    ) : null;
  };

  // Something in the menu that is not in the bottom bar is "current" under More.
  const moreIsCurrent = !!current && !TABBAR.some((n) => n.to === current.to);

  return (
    <div className={collapsed ? 'app app--collapsed' : 'app'}>
      <aside className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'}>
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <Icon name="companies" size={20} />
          </span>
          <div className="sidebar__brandtext">
            <strong>{t('app.name')}</strong>
            <small>{t('app.role')}</small>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label={t('common.menu')}>
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.key} role="group" aria-label={t(group.key)}>
              <span className="nav-group__title" aria-hidden="true">
                {t(group.key)}
              </span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? t(item.key) : undefined}
                  className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name={item.icon} size={18} />
                  <span className="nav-link__label">{t(item.key)}</span>
                  {badge(item.to)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button className="nav-link nav-link--signout" onClick={() => void signOut()} title={t('common.signOut')}>
          <Icon name="logout" size={18} />
          <span className="nav-link__label">{t('common.signOut')}</span>
        </button>
        <button
          className="nav-link nav-link--collapse"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={18} flipInRtl />
          <span className="nav-link__label">{collapsed ? t('nav.expand') : t('nav.collapse')}</span>
        </button>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <span className="topbar__title">{current ? t(current.key) : t('app.name')}</span>
          <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label={t('search.title')} title={t('search.title')}>
            <Icon name="search" size={16} />
            <span className="search-trigger__text">{t('search.trigger')}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="topbar__end">
            <AlertsBell />
            <LanguageToggle />
            <Link to="/settings" className="icon-btn" aria-label={t('nav.settings')} title={t('nav.settings')}>
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
        <main className="content" ref={contentRef}>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      <nav className="tabbar" aria-label={t('nav.bottom')}>
        {TABBAR.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'tabbar__item tabbar__item--active' : 'tabbar__item')}
            onClick={() => setMenuOpen(false)}
          >
            <span className="tabbar__icon">
              <Icon name={item.icon} size={22} />
              {badge(item.to)}
            </span>
            <span className="tabbar__label">{t(item.key)}</span>
          </NavLink>
        ))}
        <button
          className={moreIsCurrent || menuOpen ? 'tabbar__item tabbar__item--active' : 'tabbar__item'}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
        >
          <span className="tabbar__icon">
            <Icon name="more" size={22} />
          </span>
          <span className="tabbar__label">{t('nav.more')}</span>
        </button>
      </nav>
    </div>
  );
}

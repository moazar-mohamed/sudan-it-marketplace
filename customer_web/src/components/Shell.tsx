import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isUnread, useConversations } from '../data/chats';
import { useCatalog } from '../data/DataProvider';
import { loginPath } from '../data/nextPath';
import { showCountInTitle } from '../data/titleCount';
import { listenForPushOpens, refreshPush } from '../data/webPush';
import { CompareBar } from './Compare';
import { Icon, PATHS } from './Icon';
import { LanguageButton } from './LanguageSwitch';
import { PageBoundary } from './PageBoundary';
import { t } from '../i18n';

// The search loads the first time it is opened.
const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })));

/** Opens the search from anywhere on the site. */
export const openPalette = () => window.dispatchEvent(new Event('open-palette'));

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

export function Shell() {
  const [open, setOpen] = useState(false);
  const { notifications, profile } = useCatalog();
  const uid = profile?.id ?? null;
  const chats = useConversations(uid ?? '').items?.filter(isUnread).length ?? 0;
  const { pathname, search } = useLocation();
  // The products and the services tabs share one page: the kind in the address says which.
  const browsing = pathname.startsWith('/browse') || pathname.startsWith('/category/');
  const browseKind = new URLSearchParams(search).get('kind') === 'services' ? 'services' : 'products';
  const unread = notifications?.filter((n) => !n.isRead).length ?? 0;
  const close = useCallback(() => setOpen(false), []);
  const navigate = useNavigate();

  // The tab's title counts what is waiting: unread notifications and conversations.
  useEffect(() => showCountInTitle(unread + chats), [unread, chats]);
  // A pressed push opens its page in this tab; this browser's push address is kept fresh.
  useEffect(() => listenForPushOpens((path) => navigate(path)), [navigate]);
  useEffect(() => {
    if (uid) void refreshPush(uid);
  }, [uid]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    }
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-palette', onOpen);
    };
  }, []);

  // A new page starts at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // The same links sit in the header on a wide screen and in a strip under it on a phone.
  // A visitor browses without an account: the account links wait for sign-in.
  const links = (
    <>
      <NavLink to="/" end className={linkClass}>{t('الرئيسية')}</NavLink>
      <NavLink to="/browse" className={() => (browsing && browseKind === 'products' ? 'active' : '')}>{t('المنتجات')}</NavLink>
      <NavLink to="/browse?kind=services" className={() => (browsing && browseKind === 'services' ? 'active' : '')}>{t('الخدمات')}</NavLink>
      <NavLink to="/companies" className={linkClass}>{t('الشركات')}</NavLink>
      {uid && <NavLink to="/orders" className={linkClass}>{t('طلباتي')}</NavLink>}
      {uid && (
        <NavLink to="/chats" className={linkClass}>
          {t('المحادثات')}
          {chats > 0 && <span className="nav-count" aria-label={t('{0} غير مقروءة', chats)}>{chats > 9 ? '9+' : chats}</span>}
        </NavLink>
      )}
    </>
  );

  return (
    <div className="shell">
      {/* The navy bar runs the full width of the screen; its contents keep the page's width. */}
      <header className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand" aria-label="Sudan ICT Marketplace">
          <img className="brand-logo" src="/og-logo.png" alt="" width="44" height="44" />
          <span className="brand-name">
            <span className="brand-title">Sudan ICT Marketplace</span>
            <small>{t('سوق التقنية والاتصالات في السودان')}</small>
          </span>
        </NavLink>
        <nav className="nav-links" aria-label={t('التنقل الرئيسي')}>{links}</nav>
        <span className="grow" />
        {/* A small button for the site-wide search; each page with a list has its own search box. */}
        <button className="icon-btn nav-search" onClick={() => setOpen(true)} aria-label={t('بحث')} title={t('بحث')}>
          <Icon d={PATHS.search} />
        </button>
        {uid && (
          <NavLink to="/favorites" className="icon-btn nav-fav" aria-label={t('المفضلة')} title={t('المفضلة')}>
            <Icon d={PATHS.heart} />
          </NavLink>
        )}
        {uid && (
          <NavLink to="/notifications" className="icon-btn bell" aria-label={unread > 0 ? t('الإشعارات، {0} غير مقروء', unread) : t('الإشعارات')} title={t('الإشعارات')}>
            <Icon d={PATHS.bell} />
            {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
          </NavLink>
        )}
        <LanguageButton uid={uid} />
        {uid ? (
          <NavLink to="/profile" className="icon-btn solid" aria-label={t('حسابي')} title={t('حسابي')}>
            <Icon d={PATHS.user} />
          </NavLink>
        ) : (
          <Link to={loginPath(pathname + search)} className="nav-login">
            <Icon d={PATHS.user} size={18} />
            <span>{t('تسجيل الدخول')}</span>
          </Link>
        )}
      </div>
      {/* On a phone the same links sit in a second row of the navy bar. */}
      <nav className="nav-strip" aria-label={t('التنقل الرئيسي')}>{links}</nav>
      </header>
    <div className="page">
      <PageBoundary key={pathname}><Outlet /></PageBoundary>
      <CompareBar />
      {open && <Suspense fallback={null}><CommandPalette onClose={close} /></Suspense>}
    </div>
    {!pathname.startsWith('/chats') && <SiteFooter />}
    </div>
  );
}

/** The foot of every page: where the site's main places are, and what it is. */
function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
      <div className="footer-main">
        <div className="footer-about">
          <span className="footer-brand">
            <img className="footer-logo" src="/icon-192.png" alt="" width="56" height="56" />
            <strong>{t('سوق السودان للتقنية')}</strong>
          </span>
          <p>{t('شريكك الموثوق في عالم التقنية والاتصالات')}</p>
        </div>
        <nav className="footer-links" aria-label={t('روابط الموقع')}>
          <div className="footer-col">
            <h3>{t('المتجر')}</h3>
            <Link to="/">{t('الرئيسية')}</Link>
            <Link to="/browse?kind=products">{t('المنتجات')}</Link>
            <Link to="/browse?kind=services">{t('الخدمات')}</Link>
            <Link to="/companies">{t('الشركات')}</Link>
          </div>
          <div className="footer-col">
            <h3>{t('حسابي')}</h3>
            <Link to="/orders">{t('طلباتي')}</Link>
            <Link to="/favorites">{t('المفضلة')}</Link>
            {/* A request is made from a service's page: first the customer picks the service. */}
            <Link to="/browse?kind=services">{t('اطلب فنيًا')}</Link>
            <Link to="/settings">{t('الإعدادات')}</Link>
          </div>
          <div className="footer-col">
            <h3>{t('الدعم والشركات')}</h3>
            <Link to="/terms">{t('الشروط والأحكام')}</Link>
            <a href="https://company.sictm.net" target="_blank" rel="noopener noreferrer">{t('بوابة الشركات')}</a>
          </div>
        </nav>
      </div>
      <div className="footer-note">© {new Date().getFullYear()} {t('سوق السودان للتقنية')}</div>
      </div>
    </footer>
  );
}

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isUnread, useConversations } from '../data/chats';
import { useCatalog } from '../data/DataProvider';
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
  const chats = useConversations(profile.id).items?.filter(isUnread).length ?? 0;
  const { pathname } = useLocation();
  const unread = notifications?.filter((n) => !n.isRead).length ?? 0;
  const close = useCallback(() => setOpen(false), []);
  const navigate = useNavigate();

  // The tab's title counts what is waiting: unread notifications and conversations.
  useEffect(() => showCountInTitle(unread + chats), [unread, chats]);
  // A pressed push opens its page in this tab; this browser's push address is kept fresh.
  useEffect(() => listenForPushOpens((path) => navigate(path)), [navigate]);
  useEffect(() => {
    void refreshPush(profile.id);
  }, [profile.id]);

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
  const links = (
    <>
      <NavLink to="/" end className={linkClass}>{t('الرئيسية')}</NavLink>
      <NavLink to="/browse" className={linkClass}>{t('تصفح')}</NavLink>
      <NavLink to="/companies" className={linkClass}>{t('الشركات')}</NavLink>
      <NavLink to="/orders" className={linkClass}>{t('طلباتي')}</NavLink>
      <NavLink to="/chats" className={linkClass}>
        {t('المحادثات')}
        {chats > 0 && <span className="nav-count" aria-label={t('{0} غير مقروءة', chats)}>{chats > 9 ? '9+' : chats}</span>}
      </NavLink>
    </>
  );

  return (
    <div className="page">
      <header className="nav">
        <NavLink to="/" className="brand">
          <span className="brand-mark">{t('س')}</span>
          <span className="brand-name">{t('سوق التقنية')}</span>
        </NavLink>
        <nav className="nav-links" aria-label={t('التنقل الرئيسي')}>{links}</nav>
        <span className="grow" />
        <button className="search-trigger" onClick={() => setOpen(true)} aria-label={t('بحث')}>
          <Icon d={PATHS.search} size={18} />
          <span className="label">{t('عن ماذا تبحث')}</span>
          <span className="grow" />
        </button>
        <NavLink to="/favorites" className="icon-btn nav-fav" aria-label={t('المفضلة')} title={t('المفضلة')}>
          <Icon d={PATHS.heart} />
        </NavLink>
        <NavLink to="/notifications" className="icon-btn bell" aria-label={unread > 0 ? t('الإشعارات، {0} غير مقروء', unread) : t('الإشعارات')} title={t('الإشعارات')}>
          <Icon d={PATHS.bell} />
          {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
        </NavLink>
        <LanguageButton uid={profile.id} />
        <NavLink to="/profile" className="icon-btn solid" aria-label={t('حسابي')} title={t('حسابي')}>
          <Icon d={PATHS.user} />
        </NavLink>
      </header>
      <nav className="nav-strip" aria-label={t('التنقل الرئيسي')}>{links}</nav>
      <PageBoundary key={pathname}><Outlet /></PageBoundary>
      {!pathname.startsWith('/chats') && <SiteFooter />}
      <CompareBar />
      {open && <Suspense fallback={null}><CommandPalette onClose={close} /></Suspense>}
    </div>
  );
}

/** The foot of every page: where the site's main places are, and what it is. */
function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-about">
          <span className="brand">
            <span className="brand-mark">{t('س')}</span>
            {t('سوق السودان للتقنية')}
          </span>
          <p>{t('منتجات وشركات وخدمات التقنية والاتصالات في السودان')}</p>
        </div>
        <nav className="footer-links" aria-label={t('روابط الموقع')}>
          <Link to="/">{t('الرئيسية')}</Link>
          <Link to="/browse">{t('تصفح')}</Link>
          <Link to="/companies">{t('الشركات')}</Link>
          <Link to="/browse?kind=services">{t('خدمات')}</Link>
          <Link to="/service-request">{t('اطلب فنيًا')}</Link>
          <Link to="/terms">{t('الشروط والأحكام')}</Link>
          <Link to="/settings">{t('الإعدادات')}</Link>
        </nav>
      </div>
      <div className="footer-note">© {new Date().getFullYear()} {t('سوق السودان للتقنية')}</div>
    </footer>
  );
}

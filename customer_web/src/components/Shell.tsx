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

/**
 * How visitors reach the platform. Facebook and X show in the footer only once their
 * page address is filled in here, so the icons never lead to a wrong page.
 */
const CONTACT = {
  whatsapp: '249118424422',
  whatsappShown: '+249 118 424 422',
  facebook: 'https://www.facebook.com/profile.php?id=61568138772820',
  x: '',
};

const BRAND_PATHS = {
  whatsapp:
    'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z',
  facebook:
    'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z',
  x: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z',
};

function BrandIcon({ d }: { d: string }) {
  return (
    <svg className="brand-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** The foot of every page: where the site's main places are, and what it is. */
function SiteFooter() {
  const whatsappLink = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(t('مرحباً، أتواصل معكم من موقع sictm.net'))}`;
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
          <div className="footer-col footer-contact">
            <h3>{t('تواصل معنا')}</h3>
            {/* All the ways to reach us on one line: WhatsApp (with its number), then Facebook and X. */}
            <div className="footer-social">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" aria-label={`${t('واتساب')} ${CONTACT.whatsappShown}`} title={t('واتساب')}>
                <span className="soc-ico wa"><BrandIcon d={BRAND_PATHS.whatsapp} /></span>
                <span className="soc-num" dir="ltr">{CONTACT.whatsappShown}</span>
              </a>
              {CONTACT.facebook && (
                <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label={t('فيسبوك')} title={t('فيسبوك')}>
                  <span className="soc-ico"><BrandIcon d={BRAND_PATHS.facebook} /></span>
                </a>
              )}
              {CONTACT.x && (
                <a href={CONTACT.x} target="_blank" rel="noopener noreferrer" aria-label="X" title="X">
                  <span className="soc-ico"><BrandIcon d={BRAND_PATHS.x} /></span>
                </a>
              )}
            </div>
          </div>
        </nav>
      </div>
      <div className="footer-note">© {new Date().getFullYear()} {t('سوق السودان للتقنية')}</div>
      </div>
    </footer>
  );
}

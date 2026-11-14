import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompanyData } from '../data/CompanyData';
import { describeNotice } from '../data/inbox';
import { chime, RINGING_TYPES, useNewArrivals } from '../data/newArrivals';
import { showCountInTitle } from '../data/titleCount';
import { listenForPushOpens, refreshPush } from '../data/webPush';
import { useTheme } from '../theme';
import { useToast } from './toast';
import { ErrorBoundary } from './ErrorBoundary';
import { Banner, Loading } from './kit';
import { Icon, type IconName } from './Icon';
import { applyLanguage, language, t } from '../i18n';

interface Item {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  badge?: number;
}

export function Shell() {
  const { state, signOut } = useAuth();
  const { company, pendingPayment, failed, unreadChats, unreadNotices, notices } = useCompanyData();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { resolved: theme, toggle: toggleTheme } = useTheme();
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');

  // Ctrl+K or "/" jumps to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest('input,textarea,select,[contenteditable]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A new order or service request while the panel is open: a chime and a note.
  const toast = useToast();
  useNewArrivals(notices, (fresh) => {
    const ringing = fresh.filter((n) => RINGING_TYPES.has(n.type));
    if (ringing.length === 0) return;
    chime();
    const first = describeNotice(ringing[0]);
    toast(ringing.length > 1 ? t('{0} تنبيهات جديدة', ringing.length) : `${first.title}: ${first.body}`, 'info');
  });
  // The tab's title counts what is waiting; a pressed push opens its page here; this browser's push address stays fresh.
  useEffect(() => showCountInTitle(unreadNotices + unreadChats), [unreadNotices, unreadChats]);
  useEffect(() => listenForPushOpens((path) => navigate(path)), [navigate]);
  const uid = state.status === 'authorized' ? state.profile.uid : null;
  useEffect(() => {
    if (uid) void refreshPush(uid);
  }, [uid]);

  const groups: { label: string; items: Item[] }[] = [
    {
      label: t('التشغيل'),
      items: [
        { to: '/', label: t('اليوم'), icon: 'home', end: true },
        { to: '/orders', label: t('الطلبات'), icon: 'receipt', badge: pendingPayment.length },
      ],
    },
    {
      label: t('الكتالوج'),
      items: [
        { to: '/products', label: t('المنتجات'), icon: 'box' },
        { to: '/offers', label: t('العروض'), icon: 'tag' },
        { to: '/services', label: t('الخدمات'), icon: 'tool' },
      ],
    },
    {
      label: t('الشركة'),
      items: [
        { to: '/company', label: t('ملف الشركة'), icon: 'building' },
        { to: '/team', label: t('الفريق'), icon: 'users' },
        { to: '/reviews', label: t('التقييمات'), icon: 'star' },
      ],
    },
  ];

  const profile = state.status === 'authorized' ? state.profile : null;
  const name = profile?.fullName || profile?.email || '';

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (text) navigate(`/orders?q=${encodeURIComponent(text)}`);
  };

  return (
    <div className="app">
      <aside className="side" aria-label={t('القائمة الرئيسية')}>
        <div className="brand">
          <div className="logo">{company?.logoUrl ? <img src={company.logoUrl} alt="" /> : (company?.name || t('ش')).slice(0, 1)}</div>
          <div>
            <b>{company?.name || '…'}</b>
            <span>{t('لوحة الشركة')}</span>
          </div>
        </div>
        <nav className="nav">
          {groups.map((g) => (
            <div key={g.label} style={{ display: 'contents' }}>
              <div className="nav-label">{g.label}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'on' : '')}>
                  <Icon name={it.icon} />
                  {it.label}
                  {it.badge ? <span className="cnt">{it.badge}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          {failed && <div className="live off">{t('الاتصال متقطع')}</div>}
          <button type="button" className="linkbtn" onClick={() => void signOut()}>{t('تسجيل الخروج')}</button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <form className="search" onSubmit={onSearch} role="search">
            <Icon name="search" />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ابحث برقم الطلب أو اسم العميل أو رقم الهاتف…')} aria-label={t('بحث في الطلبات')} />
            <kbd>Ctrl K</kbd>
          </form>
          <span className="grow" />
          <button type="button" className="icon-btn" onClick={() => applyLanguage(language === 'ar' ? 'en' : 'ar')} aria-label={language === 'ar' ? 'English' : 'العربية'} title={language === 'ar' ? 'English' : 'العربية'} lang={language === 'ar' ? 'en' : 'ar'}>
            <b>{language === 'ar' ? 'EN' : 'ع'}</b>
          </button>
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? t('الوضع الفاتح') : t('الوضع الداكن')} title={theme === 'dark' ? t('الوضع الفاتح') : t('الوضع الداكن')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <NavLink to="/chats" className="icon-btn" aria-label={unreadChats ? t('المحادثات، {0} تنتظر ردك', unreadChats) : t('المحادثات')}>
            <Icon name="chat" />
            {unreadChats > 0 && <span className="bdg">{unreadChats}</span>}
          </NavLink>
          <NavLink to="/notifications" className="icon-btn" aria-label={unreadNotices ? t('التنبيهات، {0} غير مقروءة', unreadNotices) : t('التنبيهات')}>
            <Icon name="bell" />
            {unreadNotices > 0 && <span className="bdg">{unreadNotices}</span>}
          </NavLink>
          <div className="user">
            <span className="av">{name.slice(0, 1) || t('م')}</span>
            <div>
              <b>{name}</b>
              <div className="sub">{t('مدير الشركة')}</div>
            </div>
          </div>
        </header>
        {company && company.status !== 'active' && (
          <div style={{ padding: '16px 32px 0' }}>
            <Banner tone="warn" icon="alert">
              <b>
                {company.status === 'pending' ? t('شركتك قيد المراجعة') : company.status === 'rejected' ? t('تم رفض طلب تسجيل شركتك') : t('شركتك موقوفة')}
              </b>
              <div>{t('لا تظهر منتجاتك ولا خدماتك للعملاء حاليًا. للاستفسار تواصل مع إدارة المنصة.')}</div>
            </Banner>
          </div>
        )}
        {failed && (
          <div style={{ padding: '16px 32px 0' }}>
            <Banner tone="warn" icon="alert" tight>{t('تعذّر الاتصال بالخادم، وقد تكون الأرقام المعروضة قديمة. سنحدّثها تلقائيًا عند عودة الاتصال.')}</Banner>
          </div>
        )}
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

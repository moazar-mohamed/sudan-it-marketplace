import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompanyData } from '../data/CompanyData';
import { Banner } from './kit';
import { Icon, type IconName } from './Icon';

interface Item {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  badge?: number;
}

export function Shell() {
  const { state, signOut } = useAuth();
  const { company, pendingPayment, failed, unreadChats, unreadNotices } = useCompanyData();
  const navigate = useNavigate();
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

  const groups: { label: string; items: Item[] }[] = [
    {
      label: 'التشغيل',
      items: [
        { to: '/', label: 'اليوم', icon: 'home', end: true },
        { to: '/orders', label: 'الطلبات', icon: 'receipt', badge: pendingPayment.length },
      ],
    },
    {
      label: 'الكتالوج',
      items: [
        { to: '/products', label: 'المنتجات', icon: 'box' },
        { to: '/offers', label: 'العروض', icon: 'tag' },
        { to: '/services', label: 'الخدمات', icon: 'tool' },
      ],
    },
    {
      label: 'الشركة',
      items: [
        { to: '/company', label: 'ملف الشركة', icon: 'building' },
        { to: '/team', label: 'الفريق والتقييمات', icon: 'users' },
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
      <aside className="side" aria-label="القائمة الرئيسية">
        <div className="brand">
          <div className="logo">{company?.logoUrl ? <img src={company.logoUrl} alt="" /> : (company?.name || 'ش').slice(0, 1)}</div>
          <div>
            <b>{company?.name || '…'}</b>
            <span>لوحة الشركة</span>
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
          {failed && <div className="live off">الاتصال متقطع</div>}
          <button type="button" className="linkbtn" onClick={() => void signOut()}>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <form className="search" onSubmit={onSearch} role="search">
            <Icon name="search" />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برقم الطلب أو اسم العميل أو رقم الهاتف…" aria-label="بحث في الطلبات" />
            <kbd>Ctrl K</kbd>
          </form>
          <span className="grow" />
          <NavLink to="/chats" className="icon-btn" aria-label={unreadChats ? `المحادثات، ${unreadChats} تنتظر ردك` : 'المحادثات'}>
            <Icon name="chat" />
            {unreadChats > 0 && <span className="bdg">{unreadChats}</span>}
          </NavLink>
          <NavLink to="/notifications" className="icon-btn" aria-label={unreadNotices ? `التنبيهات، ${unreadNotices} غير مقروءة` : 'التنبيهات'}>
            <Icon name="bell" />
            {unreadNotices > 0 && <span className="bdg">{unreadNotices}</span>}
          </NavLink>
          <div className="user">
            <span className="av">{name.slice(0, 1) || 'م'}</span>
            <div>
              <b>{name}</b>
              <div className="sub">مدير الشركة</div>
            </div>
          </div>
        </header>
        {company && company.status !== 'active' && (
          <div style={{ padding: '16px 32px 0' }}>
            <Banner tone="warn" icon="alert">
              <b>
                {company.status === 'pending' ? 'شركتك قيد المراجعة' : company.status === 'rejected' ? 'تم رفض طلب تسجيل شركتك' : 'شركتك موقوفة'}
              </b>
              <div>لا تظهر منتجاتك ولا خدماتك للعملاء حاليًا. للاستفسار تواصل مع إدارة المنصة.</div>
            </Banner>
          </div>
        )}
        {failed && (
          <div style={{ padding: '16px 32px 0' }}>
            <Banner tone="warn" icon="alert" tight>
              تعذّر الاتصال بالخادم، وقد تكون الأرقام المعروضة قديمة. سنحدّثها تلقائيًا عند عودة الاتصال.
            </Banner>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { useTheme } from '../theme';
import { CityPicker } from './CityPicker';
import { CommandPalette } from './CommandPalette';
import { Icon, PATHS } from './Icon';

const THEME_LABEL = { light: 'المظهر: فاتح', dark: 'المظهر: داكن', system: 'المظهر: تلقائي' } as const;

/** Opens the search from anywhere on the site. */
export const openPalette = () => window.dispatchEvent(new Event('open-palette'));

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

export function Shell() {
  const [open, setOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const { choice, cycle } = useTheme();
  const { cities, cityId, profile, notifications } = useCatalog();
  const { pathname } = useLocation();
  const cityName = cities.find((c) => c.id === cityId)?.nameAr;
  const unread = notifications?.filter((n) => !n.isRead).length ?? 0;
  const close = useCallback(() => setOpen(false), []);

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

  const themeIcon = choice === 'dark' ? PATHS.moon : choice === 'light' ? PATHS.sun : PATHS.auto;

  return (
    <div className="page">
      <header className="nav">
        <NavLink to="/" className="brand">
          <span className="brand-mark">س</span>
          سوق التقنية
        </NavLink>
        <nav className="nav-links" aria-label="التنقل الرئيسي">
          <NavLink to="/" end className={linkClass}>الرئيسية</NavLink>
          <NavLink to="/browse" className={linkClass}>تصفح</NavLink>
          <NavLink to="/companies" className={linkClass}>الشركات</NavLink>
          <NavLink to="/orders" className={linkClass}>طلباتي</NavLink>
          <NavLink to="/chats" className={linkClass}>المحادثات</NavLink>
        </nav>
        <span className="grow" />
        <button className="search-trigger" onClick={() => setOpen(true)} aria-label="بحث">
          <Icon d={PATHS.search} size={18} />
          <span className="label">ابحث أو اكتب أمرًا</span>
          <span className="grow" />
          <span className="kbd">Ctrl</span>
          <span className="kbd">K</span>
        </button>
        <button className="nav-city" onClick={() => setCityOpen(true)} title="تغيير المدينة">
          <Icon d={PATHS.pin} size={18} />
          {cityName}
        </button>
        <button className="icon-btn theme-btn" onClick={cycle} aria-label={THEME_LABEL[choice]} title={THEME_LABEL[choice]}>
          <Icon d={themeIcon} />
        </button>
        <NavLink to="/notifications" className="icon-btn bell" aria-label={unread > 0 ? `الإشعارات، ${unread} غير مقروء` : 'الإشعارات'} title="الإشعارات">
          <Icon d={PATHS.bell} />
          {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
        </NavLink>
        <NavLink to="/profile" className="icon-btn solid" aria-label="حسابي" title="حسابي">
          <Icon d={PATHS.user} />
        </NavLink>
      </header>
      <Outlet />
      {open && <CommandPalette onClose={close} />}
      {cityOpen && <CityPicker uid={profile.id} selectedId={cityId} onClose={() => setCityOpen(false)} />}
    </div>
  );
}

import { Link, NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';
import { NAV_V2_MAIN, NAV_V2_SYSTEM, sectionOfPath, sectionPaths, underPath, type NavV2Section } from './navItemsV2';

/** How many records of each address need attention (see Layout). */
export type NavBadges = Record<string, number | null | undefined>;

export function NavBadge({ count }: { count: number }) {
  const { t, number } = useI18n();
  if (!count) return null;
  return (
    <span className="nav-badge" role="img" aria-label={t('nav.attentionCount', { count: number(count) })}>
      {count > 99 ? '99+' : number(count)}
    </span>
  );
}

export const sectionCount = (s: NavV2Section, badges: NavBadges): number =>
  sectionPaths(s).reduce((sum, p) => sum + (badges[p] ?? 0), 0);

/** The side menu of the redesign: eight sections, the current one opened to its parts. */
export function NavV2({ pathname, badges, onNavigate }: { pathname: string; badges: NavBadges; onNavigate: () => void }) {
  const { t } = useI18n();
  const current = sectionOfPath(pathname);

  const renderSection = (s: NavV2Section) => {
    const active = current?.id === s.id;
    return (
      <div className="v2-nav__section" key={s.id}>
        <Link
          to={s.to}
          className={active ? 'v2-link v2-link--active' : 'v2-link'}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate}
        >
          <Icon name={s.icon} size={20} />
          <span className="nav-link__label">{t(s.key)}</span>
          <NavBadge count={sectionCount(s, badges)} />
        </Link>
        {active && s.children && (
          <div className="v2-sub" role="group" aria-label={t('nav.sub', { section: t(s.key) })}>
            {s.children.map((c) => (
              <NavLink
                key={c.to}
                to={c.to}
                end
                className={() => (underPath(pathname, c.to) ? 'v2-sublink v2-sublink--active' : 'v2-sublink')}
                onClick={onNavigate}
              >
                <span className="nav-link__label">{t(c.key)}</span>
                <NavBadge count={badges[c.to] ?? 0} />
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="sidebar__nav v2-nav" aria-label={t('common.menu')}>
      {NAV_V2_MAIN.map(renderSection)}
      <span className="v2-nav__label" aria-hidden="true">
        {t('nav.group.system')}
      </span>
      {NAV_V2_SYSTEM.map(renderSection)}
    </nav>
  );
}

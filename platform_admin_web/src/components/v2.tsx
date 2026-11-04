import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useUi } from '../theme/ui';
import { Icon } from './Icon';
import { sectionOfPath, underPath } from './navItemsV2';
import { RowMenu } from './RowMenu';

/*
 * Building blocks of the redesign (v2). They only draw and group; every page keeps
 * its own data and actions, so moving an operation into one of them never changes
 * what the operation does.
 */

/**
 * The tabs of the section you are in (Orders: product orders | service requests, ...).
 * They read the menu, so a page gets them without knowing about them. Shown on the
 * pages of a section that has parts, and nowhere else.
 */
export function SectionTabs() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const section = sectionOfPath(pathname);
  if (!section?.children) return null;
  return (
    <nav className="ds-tabs" aria-label={t('nav.sub', { section: t(section.key) })}>
      {section.children.map((c) => (
        <Link key={c.to} to={c.to} aria-current={underPath(pathname, c.to) ? 'page' : undefined}>
          {t(c.key)}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The filters of a list in the redesign: not a box that opens, but pills sitting in the
 * toolbar, each one a choice you can see and change at once. When any is in use a "clear"
 * button appears. The filters themselves (and where their values live) are the page's own:
 * this only decides how they are shown; with the redesign off they stay exactly as they were.
 */
export function FilterGroup({ count = 0, onClear, children }: { count?: number; onClear?: () => void; children: ReactNode }) {
  const { ui } = useUi();
  const { t } = useI18n();
  if (ui !== 'v2') return <>{children}</>;
  return (
    <div className={count > 0 ? 'ds-pills ds-pills--active' : 'ds-pills'} role="group" aria-label={t('common.filters')}>
      <Icon name="filter" size={16} />
      {children}
      {count > 0 && onClear && (
        <button type="button" className="ds-pills__clear" onClick={onClear}>
          {t('common.clearFilters')}
        </button>
      )}
    </div>
  );
}

/** A record's details beside its list: closes with the button or Escape. */
export function SidePanel({
  title,
  subtitle,
  status,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className="ds-panel" role="complementary" aria-label={title}>
      <div className="ds-panel__head">
        <div>
          {subtitle && <small>{subtitle}</small>}
          <h2>{title}</h2>
        </div>
        {status}
        <button type="button" className="icon-btn" aria-label={closeLabel} onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="ds-panel__body">{children}</div>
    </aside>
  );
}

/**
 * The export of a list. The current look keeps it as a button in the page header; the redesign
 * tucks it into the "..." menu so a rarely used action does not sit in the header on its own.
 */
export function ExportAction({ label, disabled, title, onExport }: { label: string; disabled?: boolean; title?: string; onExport: () => void }) {
  const { ui } = useUi();
  const { t } = useI18n();
  if (ui !== 'v2') {
    return (
      <button className="btn btn--sm" disabled={disabled} title={title} onClick={onExport}>
        {label}
      </button>
    );
  }
  return <RowMenu label={t('common.actions')} disabled={false} items={[{ key: 'export', label, disabled, onSelect: onExport }]} />;
}

/** A list with a record's panel beside it; with no panel it is just the list. */
export function SplitView({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  if (!panel) return <>{children}</>;
  return (
    <div className="ds-split">
      <div className="ds-split__main">{children}</div>
      {panel}
    </div>
  );
}

/** Actions of a record in a titled group; `danger` is the quiet red group for sensitive ones. */
export function ActionGroup({ title, danger, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <section className={danger ? 'ds-group ds-group--danger' : 'ds-group'} aria-label={title}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** The bar that appears while records are selected: how many, and what can be done to them. */
export function BulkBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ds-bulk" role="region" aria-label={label}>
      <strong>{label}</strong>
      <span style={{ flex: 1 }} />
      {children}
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';

/* ---------- Layout primitives ---------- */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="page-header">
      <div>
        {back && (
          <Link to={back.to} className="back-link">
            <Icon name="back" size={16} flipInRtl /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  flush,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card__head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      <div className={flush ? 'card__body card__body--flush' : 'card__body'}>{children}</div>
    </section>
  );
}

export function KeyValue({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  to,
}: {
  label: string;
  value: string;
  icon: Parameters<typeof Icon>[0]['name'];
  to?: string;
}) {
  const inner = (
    <>
      <span className="stat__icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="stat stat--link">
      {inner}
    </Link>
  ) : (
    <div className="stat">{inner}</div>
  );
}

/* ---------- Status pieces ---------- */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'progress' | 'neutral';

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Thumb({
  src,
  round,
  size = 40,
}: {
  src: string;
  round?: boolean;
  size?: number;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== '' && failedSrc !== src;
  return (
    <span
      className={round ? 'thumb thumb--round' : 'thumb'}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Icon name="image" size={Math.round(size * 0.5)} />
      )}
    </span>
  );
}

/* ---------- Loading / empty / error ---------- */

export function LoadingState() {
  const { t } = useI18n();
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <p className="muted">{t('common.loading')}</p>
    </div>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="state">
      <span className="state__icon">
        <Icon name="inbox" size={36} />
      </span>
      <p>{message}</p>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon">
        <Icon name="alert" size={36} />
      </span>
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

interface Gate {
  status: 'loading' | 'ready' | 'error';
  error: unknown;
  retry: () => void;
}

/** Shows loading / error for one or more live collections, else the page. */
export function DataGate({ gates, children }: { gates: Gate[]; children: ReactNode }) {
  const { t } = useI18n();
  const failed = gates.find((g) => g.status === 'error');
  if (failed) {
    const code = (failed.error as { code?: string } | null)?.code;
    return (
      <ErrorState
        message={code === 'permission-denied' ? t('error.permission') : t('error.load')}
        onRetry={() => gates.forEach((g) => g.status === 'error' && g.retry())}
      />
    );
  }
  if (gates.some((g) => g.status === 'loading')) return <LoadingState />;
  return <>{children}</>;
}

/* ---------- Controls ---------- */

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search">
      <Icon name="search" size={16} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T | 'all'; label: string; count: number }[];
  value: T | 'all';
  onChange: (value: T | 'all') => void;
}) {
  return (
    <div className="chips" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'chip chip--active' : 'chip'}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label} <span className="chip__count">{o.count}</span>
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  narrow,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  narrow?: boolean;
  wide?: boolean;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={narrow ? 'modal modal--narrow' : wide ? 'modal modal--wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** User-entered text (names, descriptions) may be Arabic or English. */
export function Text({ children }: { children: ReactNode }) {
  return <bdi>{children}</bdi>;
}

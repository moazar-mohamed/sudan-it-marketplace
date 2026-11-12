import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import { useTechData } from '../data/TechData';
import { clock } from '../data/format';
import type { Job } from '../data/types';
import { Icon, type IconName } from './Icon';

/* ── Status ─────────────────────────────────────────────────────────── */

export type Tone = 'info' | 'go' | 'warn' | 'ok' | 'off';

/** A job's state as the technician reads it, and its colour. [short] fits small rows. */
export function jobStatus(job: Job, short = false): { label: string; tone: Tone } {
  switch (job.orderStatus) {
    case 'cancelled':
      return { label: short ? t('ملغاة') : t('ملغاة من الشركة'), tone: 'off' };
    case 'completed':
      return { label: t('مكتملة'), tone: 'ok' };
    case 'out_for_delivery':
      return { label: t('في الطريق'), tone: 'go' };
    default:
      return job.paymentStatus === 'confirmed'
        ? { label: t('قيد التجهيز'), tone: 'info' }
        : { label: short ? t('بانتظار الدفع') : t('بانتظار تأكيد الدفع'), tone: 'warn' };
  }
}

export function StatusBadge({ job, short, onBar }: { job: Job; short?: boolean; onBar?: boolean }) {
  const s = jobStatus(job, short);
  return <span className={`st ${onBar ? 'onbar' : s.tone}`}>{s.label}</span>;
}

/* ── Progress steps ─────────────────────────────────────────────────── */

export function JobSteps({ job, large }: { job: Job; large?: boolean }) {
  const labels =
    job.deliveryMethod === 'pickup'
      ? [t('تأكيد الدفع'), t('قيد التجهيز'), t('اكتملت')]
      : [t('تأكيد الدفع'), t('قيد التجهيز'), t('في الطريق'), t('اكتملت')];
  let at = 1;
  if (job.paymentStatus !== 'confirmed' && job.orderStatus === 'processing') at = 0;
  if (job.orderStatus === 'out_for_delivery') at = 2;
  if (job.orderStatus === 'completed') at = labels.length;
  const items: ReactNode[] = [];
  labels.forEach((label, i) => {
    if (i > 0) items.push(<li key={`l${i}`} aria-hidden="true" className={`ln${i <= at ? ' done' : ''}`} />);
    const state = i < at ? 'done' : i === at ? 'cur' : '';
    items.push(
      <li key={i} className={`step ${state}`} aria-current={state === 'cur' ? 'step' : undefined}>
        <span className="c">{state === 'done' && <Icon name="check" />}</span>
        <span>{label}</span>
        {state === 'done' && <span className="sr">{t('(تمت)')}</span>}
      </li>,
    );
  });
  return (
    <ol className={`steps${large ? ' lg' : ''}`} aria-label={t('تقدّم المهمة')}>
      {items}
    </ol>
  );
}

/* ── Bars ───────────────────────────────────────────────────────────── */

export function BellButton() {
  const { unreadNotices } = useTechData();
  return (
    <Link className="ib" to="/notifications" aria-label={unreadNotices ? t('الإشعارات، {0} جديدة', unreadNotices) : t('الإشعارات')}>
      <Icon name="bell" />
      {unreadNotices > 0 && <span className="cnt">{unreadNotices > 99 ? '99+' : unreadNotices}</span>}
    </Link>
  );
}

export function BackButton({ to, label }: { to?: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="ib"
      aria-label={label}
      onClick={() => {
        // Opened from a push or a link: there is nothing to go back to inside the portal.
        if (to && (window.history.state?.idx ?? 0) === 0) navigate(to, { replace: true });
        else navigate(-1);
      }}
    >
      <Icon name="back" />
    </button>
  );
}

/** "الاتصال متقطع · تعرض آخر نسخة من 10:42 — تغيير واحد بانتظار الإرسال". */
export function OfflineStrip() {
  const { online, syncedAt, pendingCount } = useTechData();
  if (online && pendingCount === 0) return null;
  const pending =
    pendingCount === 0 ? null : pendingCount === 1 ? t('تغيير واحد بانتظار الإرسال') : t('{0} تغييرات بانتظار الإرسال', pendingCount);
  return (
    <div className="topstrip" role="status">
      <Icon name={online ? 'refresh' : 'offline'} small />
      <span className="minw">
        {online ? t('جارٍ إرسال تغييراتك') : syncedAt ? t('الاتصال متقطع · تعرض آخر نسخة من {0}', clock(syncedAt)) : t('الاتصال متقطع · تعرض آخر نسخة محفوظة')}
      </span>
      {pending && <span style={{ fontWeight: 600 }}>{pending}</span>}
    </div>
  );
}

/* ── Bottom tabs ────────────────────────────────────────────────────── */

function Tab({ to, icon, label, count, countLabel }: { to: string; icon: IconName; label: string; count: number; countLabel: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `tab${isActive ? ' on' : ''}`} aria-label={count ? `${label}، ${countLabel}` : undefined}>
      <span className="pill">
        <Icon name={icon} />
        {count > 0 && <span className="dot">{count > 99 ? '99+' : count}</span>}
      </span>
      {label}
    </NavLink>
  );
}

export function Tabs() {
  const { newJobIds, unreadChats } = useTechData();
  return (
    <nav className="tabs" aria-label={t('التنقل الرئيسي')}>
      <Tab to="/" icon="home" label={t('الرئيسية')} count={0} countLabel="" />
      <Tab to="/jobs" icon="wrench" label={t('المهام')} count={newJobIds.size} countLabel={t('{0} مهام جديدة', newJobIds.size)} />
      <Tab to="/chats" icon="chat" label={t('المحادثات')} count={unreadChats} countLabel={t('{0} رسائل جديدة', unreadChats)} />
      <Tab to="/profile" icon="user" label={t('حسابي')} count={0} countLabel="" />
    </nav>
  );
}

/* ── Bottom sheet ───────────────────────────────────────────────────── */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: (titleId: string) => ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={ref} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} aria-label={title}>
        <span className="grab" aria-hidden="true" />
        {children(id)}
      </section>
    </div>
  );
}

/* ── Switch, loading ────────────────────────────────────────────────── */

export function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" className="sw" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="center" role="status">
      <span className="spin" aria-hidden="true" />
      <span>{label ?? t('جارٍ التحميل…')}</span>
    </div>
  );
}

export function SkeletonCards({ count = 3, height = 96 }: { count?: number; height?: number }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel" style={{ height }} />
      ))}
    </div>
  );
}

/** A phone number as a tel: link target. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

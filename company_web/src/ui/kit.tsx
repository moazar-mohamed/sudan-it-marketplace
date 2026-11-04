import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import type { CancelReason, Order, OrderStatus, PaymentStatus } from '../data/types';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'n';

export function Chip({ tone = 'n', dot = true, small, children }: { tone?: Tone; dot?: boolean; small?: boolean; children: ReactNode }) {
  return <span className={`chip c-${tone}${dot ? '' : ' nd'}${small ? ' sm' : ''}`}>{children}</span>;
}

export function Banner({
  tone = 'info',
  icon = 'info',
  tight,
  children,
  action,
}: {
  tone?: 'warn' | 'info' | 'bad' | 'ok';
  icon?: IconName;
  tight?: boolean;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`banner bn-${tone}${tight ? ' tight' : ''}`} role={tone === 'bad' || tone === 'warn' ? 'status' : undefined}>
      <Icon name={icon} />
      <div className="grow">{children}</div>
      {action}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />
  );
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="جارٍ التحميل" />;
}

export function Loading({ text = 'جارٍ التحميل…' }: { text?: string }) {
  return (
    <div className="center">
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

export function Empty({ icon = 'info', text, action }: { icon?: IconName; text: string; action?: ReactNode }) {
  return (
    <div className="center">
      <Icon name={icon} size="lg" />
      <span>{text}</span>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: { to?: string; label: string }[];
  actions?: ReactNode;
}) {
  return (
    <>
      {crumbs && (
        <div className="crumb">
          {crumbs.map((c, i) => (
            <span key={i} className="row" style={{ gap: 6 }}>
              {i > 0 && <Icon name="chevron" size="sm" />}
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
            </span>
          ))}
        </div>
      )}
      <div className="ph">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="row wrap">{actions}</div>}
      </div>
    </>
  );
}

/** A modal dialog: Escape and the backdrop close it unless it is [busy]. */
/** The dialogs that are open, oldest first. */
const openModals: object[] = [];

export function Modal({
  title,
  onClose,
  busy,
  wide,
  xl,
  children,
  footer,
  labelledBy = 'dlg-title',
}: {
  title: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  /** Wider still, for a table or a map. */
  xl?: boolean;
  children: ReactNode;
  footer: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const me = useRef({}).current;
  // Registered once on opening, so a re-render never moves it above a dialog opened later.
  useEffect(() => {
    openModals.push(me);
    return () => { openModals.splice(openModals.indexOf(me), 1); };
  }, [me]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Escape closes only the dialog on top (a map opened from a dialog, say).
      if (e.key === 'Escape' && !busy && openModals[openModals.length - 1] === me) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [busy, onClose, me]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div ref={ref} tabIndex={-1} className={`dlg${wide || xl ? ' wide' : ''}${xl ? ' xl' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="dlg-b">
          <h2 id={labelledBy}>{title}</h2>
          {children}
        </div>
        <div className="dlg-f">{footer}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'تراجع',
  danger,
  busy,
  onConfirm,
  onClose,
  disabled,
  children,
}: {
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className={`btn ${danger ? 'dp' : 'p'}`} disabled={busy || disabled} onClick={onConfirm}>
            {busy && <Spinner />}
            {confirmLabel}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
        </>
      }
    >
      {body && <p className="muted">{body}</p>}
      {children}
    </Modal>
  );
}

/** Re-renders every [ms] so countdowns stay true; returns the current time. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

// ── Labels ─────────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  processing: 'معالجة',
  out_for_delivery: 'في الطريق',
  completed: 'مكتمل',
  cancelled: 'ملغى',
};
export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending_verification: 'بانتظار التحقق',
  confirmed: 'مؤكد',
};
export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  company: 'ألغته الشركة',
  expired: 'انتهت مهلة الدفع',
  out_of_stock: 'نفد المخزون',
  admin: 'ألغته المنصة',
};

export function OrderStatusChip({ order }: { order: Order }) {
  const tone: Tone = order.orderStatus === 'completed' ? 'ok' : order.orderStatus === 'cancelled' ? 'n' : 'info';
  const readyToHandOver = order.orderStatus === 'processing' && order.paymentStatus === 'confirmed' && order.deliveryMethod === 'pickup';
  return <Chip tone={tone} dot={false}>{readyToHandOver ? 'جاهز للتسليم' : ORDER_STATUS_LABEL[order.orderStatus]}</Chip>;
}

export function PaymentChip({ order }: { order: Order }) {
  if (order.orderStatus === 'cancelled' && order.paymentStatus === 'pending_verification') return <Chip tone="n">لم يؤكَّد</Chip>;
  return <Chip tone={order.paymentStatus === 'confirmed' ? 'ok' : 'warn'}>{PAYMENT_LABEL[order.paymentStatus]}</Chip>;
}

export const DELIVERY_ICON: Record<'delivery' | 'pickup' | 'install', IconName> = { delivery: 'truck', pickup: 'pin', install: 'tool' };

/** One kind per order, by the most it asks of the company: installation, else delivery, else pickup. */
export function orderKind(o: Order): 'delivery' | 'pickup' | 'install' {
  return o.installationSelected ? 'install' : o.deliveryMethod === 'pickup' ? 'pickup' : 'delivery';
}
export const KIND_LABEL = { delivery: 'توصيل', pickup: 'استلام', install: 'تركيب' } as const;

export function KindCell({ order }: { order: Order }) {
  const k = orderKind(order);
  return (
    <span className="row" style={{ gap: 6 }}>
      <Icon name={DELIVERY_ICON[k]} size="sm" />
      {KIND_LABEL[k]}
    </span>
  );
}

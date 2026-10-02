import { useI18n } from '../i18n/I18nProvider';
import type {
  CompanyStatus,
  OrderStatus,
  PaymentStatus,
  ServiceRequestStatus,
} from '../data/types';
import { Badge, type Tone } from './ui';

export const COMPANY_TONE: Record<CompanyStatus, Tone> = {
  active: 'success',
  pending: 'warning',
  rejected: 'danger',
  inactive: 'neutral',
};
export const ORDER_TONE: Record<OrderStatus, Tone> = {
  processing: 'info',
  out_for_delivery: 'progress',
  completed: 'success',
  cancelled: 'danger',
};
export const SERVICE_REQUEST_TONE: Record<ServiceRequestStatus, Tone> = {
  pending: 'warning',
  accepted: 'info',
  in_progress: 'progress',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};
export const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  pending_verification: 'warning',
  confirmed: 'success',
};

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  const { t } = useI18n();
  return <Badge tone={COMPANY_TONE[status]}>{t(`company.status.${status}`)}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return <Badge tone={ORDER_TONE[status]}>{t(`order.status.${status}`)}</Badge>;
}

export function ServiceRequestStatusBadge({ status }: { status: ServiceRequestStatus }) {
  const { t } = useI18n();
  return (
    <Badge tone={SERVICE_REQUEST_TONE[status]}>{t(`serviceRequest.status.${status}`)}</Badge>
  );
}

/**
 * A cancelled order whose payment was not verified never will be, so with
 * its [orderStatus] it is not shown as still waiting for verification. One
 * cancelled after its payment was confirmed still shows Confirmed: the
 * company returns that money outside the app.
 */
export function PaymentBadge({
  status,
  orderStatus,
}: {
  status: PaymentStatus;
  orderStatus?: OrderStatus;
}) {
  const { t } = useI18n();
  if (orderStatus === 'cancelled' && status === 'pending_verification') {
    return <Badge tone="neutral">{t('payment.not_verified')}</Badge>;
  }
  return <Badge tone={PAYMENT_TONE[status]}>{t(`payment.${status}`)}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useI18n();
  return (
    <Badge tone={active ? 'success' : 'neutral'}>
      {active ? t('user.active') : t('user.inactive')}
    </Badge>
  );
}

export function AvailabilityBadge({ available }: { available: boolean }) {
  const { t } = useI18n();
  return (
    <Badge tone={available ? 'success' : 'danger'}>
      {available ? t('product.available') : t('product.unavailable')}
    </Badge>
  );
}

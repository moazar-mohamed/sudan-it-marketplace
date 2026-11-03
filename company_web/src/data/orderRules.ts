import type { Order, OrderStatus } from './types';

/** The next step of a confirmed order: pickup orders complete directly, others go out for delivery first. */
export function nextStatusOf(order: Pick<Order, 'paymentStatus' | 'orderStatus' | 'deliveryMethod'>): OrderStatus | null {
  if (order.paymentStatus !== 'confirmed') return null;
  if (order.orderStatus === 'processing') return order.deliveryMethod === 'pickup' ? 'completed' : 'out_for_delivery';
  if (order.orderStatus === 'out_for_delivery') return 'completed';
  return null;
}

/** A paid order that was cancelled and whose refund the company has not recorded yet. */
export const awaitsRefund = (o: Pick<Order, 'orderStatus' | 'paymentStatus' | 'refundedAt'>): boolean =>
  o.orderStatus === 'cancelled' && o.paymentStatus === 'confirmed' && o.refundedAt === null;

export function nextStatusLabel(order: Pick<Order, 'paymentStatus' | 'orderStatus' | 'deliveryMethod'>): string {
  const next = nextStatusOf(order);
  if (next === 'out_for_delivery') return 'شحن: في الطريق';
  if (next === 'completed') return order.deliveryMethod === 'pickup' ? 'تم التسليم للعميل' : 'تم التسليم';
  return '';
}

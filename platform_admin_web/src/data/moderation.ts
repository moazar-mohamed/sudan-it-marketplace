import type { DocumentData } from 'firebase/firestore';

/**
 * What cancelling an order as Platform Admin must do to its product's stock.
 * The same decision the rules make (isPlatformAdminOrderCancellation, which
 * mirrors the company's own cancellation):
 *  - an order that took its stock gives exactly its quantity back, once;
 *  - it took it when its payment was confirmed, or when it was placed before
 *    stock moved to the confirmation: `stockReserved` true, or no such field
 *    at all (only an explicit false means "not taken");
 *  - and only to its own company's product that still exists: a product that
 *    is gone, or whose id another company has since reused, gets nothing, and
 *    the order is cancelled with stockReleased false.
 */
export function adminCancellationPlan(
  order: DocumentData,
  product: DocumentData | undefined,
): { returnsStock: boolean; quantity: number } {
  const quantity = Number(order.quantity);
  const returnsStock = order.stockReserved !== false && product !== undefined && product.companyId === order.companyId;
  return { returnsStock, quantity };
}

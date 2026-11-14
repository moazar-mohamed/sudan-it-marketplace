/*
 * Telling people what Platform Admin did, in the batch that does it. Each
 * notice carries no text of its own: the apps and the push relay word it from
 * its type and the name of what it is about, in the reader's language, and the
 * security rules check it is true (the order really was cancelled by the admin,
 * the product really is hidden or shown, and it goes to the right people).
 */

export type AdminOrderNoticeType = 'order_cancelled_by_admin' | 'order_cancelled_by_admin_company';
export type AdminProductNoticeType = 'product_hidden' | 'product_shown';

export interface AdminOrderNotice {
  /** `{orderId}_{type}`: one per order and type, as the rules require. */
  id: string;
  recipientType: 'customer' | 'company_admin';
  recipientId: string;
  orderId: string;
  type: AdminOrderNoticeType;
  /** The order's product name: the only text, and the rules check it is the order's own. */
  productName: string;
}

export interface AdminProductNotice {
  recipientType: 'company_admin';
  /** The company that owns the product (all its admins read it). */
  recipientId: string;
  productId: string;
  type: AdminProductNoticeType;
  productName: string;
}

export interface AdminAccountNotice {
  /** `{companyId}_account_converted_to_company`: one per company, as the rules require. */
  id: string;
  recipientType: 'company_admin';
  /** The new company: its admins (the converted person is now one) read it. */
  recipientId: string;
  /** The account that was turned into the company's admin. */
  userId: string;
  type: 'account_converted_to_company';
  /** The company's name: the only text, and the rules check it is the company's own. */
  productName: string;
}

/** The notice for a customer whose account the admin turned into a company's. */
export function accountConvertedNotice(account: {
  userId: string;
  companyId: string;
  companyName: string;
}): AdminAccountNotice {
  return {
    id: `${account.companyId}_account_converted_to_company`,
    recipientType: 'company_admin',
    recipientId: account.companyId,
    userId: account.userId,
    type: 'account_converted_to_company',
    productName: account.companyName,
  };
}

/** The two notices for an order the admin cancelled: its customer, and its company. */
export function orderCancelledNotices(order: {
  id: string;
  customerId: string;
  companyId: string;
  productName: string;
}): AdminOrderNotice[] {
  const notices: AdminOrderNotice[] = [];
  if (order.customerId) {
    notices.push({
      id: `${order.id}_order_cancelled_by_admin`,
      recipientType: 'customer',
      recipientId: order.customerId,
      orderId: order.id,
      type: 'order_cancelled_by_admin',
      productName: order.productName,
    });
  }
  if (order.companyId) {
    notices.push({
      id: `${order.id}_order_cancelled_by_admin_company`,
      recipientType: 'company_admin',
      recipientId: order.companyId,
      orderId: order.id,
      type: 'order_cancelled_by_admin_company',
      productName: order.productName,
    });
  }
  return notices;
}

/** The notice for the company of a product the admin hid (or showed again). */
export function productHiddenNotice(
  product: { id: string; name: string; companyId: string },
  hidden: boolean,
): AdminProductNotice | null {
  if (!product.companyId) return null;
  return {
    recipientType: 'company_admin',
    recipientId: product.companyId,
    productId: product.id,
    type: hidden ? 'product_hidden' : 'product_shown',
    productName: product.name,
  };
}

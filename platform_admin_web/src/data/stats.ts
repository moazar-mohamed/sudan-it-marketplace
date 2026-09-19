import type { Company, Order, OrderStatus } from './types';

/*
 * The counting rules behind the dashboard cards. They run on documents that
 * were read live from Firestore and mapped by data/mappers.ts, and the pages
 * behind the cards filter with these same rules, so a card's number is exactly
 * the number of rows its link shows.
 */

/** A company without a stored status counts as active (same as the customer app). */
export const isActiveCompany = (company: Company): boolean => company.status === 'active';

export const countActiveCompanies = (companies: Company[]): number =>
  companies.filter(isActiveCompany).length;

export const countOrdersWithStatus = (orders: Order[], status: OrderStatus): number =>
  orders.filter((o) => o.orderStatus === status).length;

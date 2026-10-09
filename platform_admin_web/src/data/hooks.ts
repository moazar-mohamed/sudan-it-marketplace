import { useMemo } from 'react';
import { stores, useStore } from './store';

export const useCompanies = () => useStore(stores.companies);
export const useCustomers = () => useStore(stores.customers);
export const useReports = () => useStore(stores.reports);
export const useNewReports = () => useStore(stores.newReports);
export const useAdmins = () => useStore(stores.admins);
export const useProducts = (enabled = true) => useStore(stores.products, enabled);
/** Every category, the ones in the trash too (for names, and for deleting for good). */
export const useAllCategories = () => useStore(stores.categories);
/** The categories that are in use: the ones in the trash are left out. */
export function useCategories() {
  const state = useStore(stores.categories);
  const data = useMemo(() => state.data.filter((c) => !c.trashedAt), [state.data]);
  return { ...state, data };
}
/** Only the categories in the trash (each one still carries its own subtree markers). */
export function useTrashedCategories() {
  const state = useStore(stores.categories);
  const data = useMemo(() => state.data.filter((c) => !!c.trashedAt), [state.data]);
  return { ...state, data };
}
export const useServices = () => useStore(stores.services);
export const useCompanyServices = () => useStore(stores.companyServices);
export const useServiceRequests = () => useStore(stores.serviceRequests);
export const useReviews = () => useStore(stores.reviews);
export const useAuditLog = () => useStore(stores.auditLog);

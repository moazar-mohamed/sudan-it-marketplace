import { useMemo } from 'react';
import { stores, useStore } from './store';

/** The companies, each with its email from company_private (never on the public document). */
export function useCompanies() {
  const state = useStore(stores.companies);
  const privates = useStore(stores.companyPrivate);
  const data = useMemo(() => {
    const emails = new Map(privates.data.map((p) => [p.id, p.email]));
    return state.data.map((c) => ({ ...c, email: emails.get(c.id) || c.email }));
  }, [state.data, privates.data]);
  return { ...state, data };
}
export const useCustomers = () => useStore(stores.customers);
export const useReports = () => useStore(stores.reports);
export const useNewReports = () => useStore(stores.newReports);
/** The admins who are in use: the ones in the trash are left out. */
export function useAdmins() {
  const state = useStore(stores.admins);
  const data = useMemo(() => state.data.filter((a) => !a.trashedAt), [state.data]);
  return { ...state, data };
}
/** Only the admins in the trash. */
export function useTrashedAdmins() {
  const state = useStore(stores.admins);
  const data = useMemo(() => state.data.filter((a) => !!a.trashedAt), [state.data]);
  return { ...state, data };
}
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

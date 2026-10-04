import { stores, useStore } from './store';

export const useCompanies = () => useStore(stores.companies);
export const useCustomers = () => useStore(stores.customers);
export const useReports = () => useStore(stores.reports);
export const useNewReports = () => useStore(stores.newReports);
export const useAdmins = () => useStore(stores.admins);
export const useProducts = (enabled = true) => useStore(stores.products, enabled);
export const useCategories = () => useStore(stores.categories);
export const useServices = () => useStore(stores.services);
export const useCompanyServices = () => useStore(stores.companyServices);
export const useServiceRequests = () => useStore(stores.serviceRequests);
export const useReviews = () => useStore(stores.reviews);
export const useAuditLog = () => useStore(stores.auditLog);

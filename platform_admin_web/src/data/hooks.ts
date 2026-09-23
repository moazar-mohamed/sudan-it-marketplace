import { stores, useStore } from './store';

export const useCompanies = () => useStore(stores.companies);
export const useCustomers = () => useStore(stores.customers);
export const useProducts = () => useStore(stores.products);
export const useOrders = () => useStore(stores.orders);
export const useCategories = () => useStore(stores.categories);
export const useServices = () => useStore(stores.services);
export const useServiceRequests = () => useStore(stores.serviceRequests);
export const useReviews = () => useStore(stores.reviews);

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { buildServiceListings, countByCategory, servesCity } from './browse';
import type { CategoryCount, Ratings } from './browse';
import { CategoryTree } from './categoryTree';
import { useFavorites } from './favorites';
import { useCategories, useCities, useCompanies, useCompanyServices, useNotifications, useProducts, useRatings, useServices } from './hooks';
import { isOnSale } from './mappers';
import type { AppNotification, CatalogService, City, Company, CompanyService, Favorite, Product, ServiceListing, UserProfile } from './types';

interface CatalogValue {
  tree: CategoryTree;
  /** In-stock products of active companies, those serving the customer's city first. */
  products: Product[];
  /** Active companies, those serving the customer's city first. */
  companies: Company[];
  /** Active services of active categories (what search finds). */
  services: CatalogService[];
  /** Services a visible company performs; empty until everything has loaded. */
  listings: ServiceListing[];
  links: CompanyService[];
  ratings: Ratings;
  /** Null until the catalogue has loaded, so categories never look empty. */
  counts: Map<string, CategoryCount> | null;
  /** How many products and services each visible company offers. */
  itemCounts: Map<string, number>;
  /** The names people can search for: what a "did you mean" is built from. */
  vocabulary: string[];
  cities: City[];
  cityId: string | null;
  /** Null for a visitor who browses without signing in. */
  profile: UserProfile | null;
  /** Null until they have loaded. */
  notifications: AppNotification[] | null;
  /** Null until they have loaded. */
  favorites: Favorite[] | null;
  /** Null when the customer has no city: nothing is then ranked or labelled. */
  servingIds: Set<string> | null;
  loading: boolean;
  error: boolean;
}

const CatalogContext = createContext<CatalogValue | null>(null);

function newestFirst(a: Product, b: Product): number {
  return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
}

/** One shared set of live listeners for the whole site; [profile] null for a visitor. */
export function CatalogProvider({ profile, children }: { profile: UserProfile | null; children: ReactNode }) {
  const categories = useCategories();
  const rawProducts = useProducts();
  const rawCompanies = useCompanies();
  const rawServices = useServices();
  const rawLinks = useCompanyServices();
  const rawRatings = useRatings();
  const cities = useCities();
  const notifications = useNotifications(profile?.id ?? '');
  const favorites = useFavorites(profile?.id ?? '');
  const cityId = profile?.cityId ?? null;

  const value = useMemo<CatalogValue>(() => {
    const tree = new CategoryTree(categories.items ?? []);

    const active = (rawCompanies.items ?? []).filter((c) => c.status === 'active');
    const companies = [
      ...active.filter((c) => servesCity(c, cityId)),
      ...active.filter((c) => !servesCity(c, cityId)),
    ];
    const activeIds = new Set(active.map((c) => c.id));
    const servingIds = cityId === null || rawCompanies.items === null
      ? null
      : new Set((rawCompanies.items ?? []).filter((c) => servesCity(c, cityId)).map((c) => c.id));

    // Company products stay hidden until the company list has loaded.
    const visible = [...(rawProducts.items ?? [])]
      .sort(newestFirst)
      .filter((p) => isOnSale(p) && p.stockCount > 0 && (p.companyId === '' || activeIds.has(p.companyId)));
    const serves = (p: Product) => p.companyId === '' || !servingIds || servingIds.has(p.companyId);
    const products = [...visible.filter(serves), ...visible.filter((p) => !serves(p))];

    const services = (rawServices.items ?? [])
      .filter((s) => s.isActive && tree.isEffectivelyActive(s.categoryId))
      .sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
    const links = rawLinks.items ?? [];
    const listings = buildServiceListings(services, links, companies).filter((l) => l.offers.length > 0);

    const loaded =
      categories.items !== null && rawProducts.items !== null && rawCompanies.items !== null &&
      rawServices.items !== null && rawLinks.items !== null;

    const itemCounts = new Map<string, number>();
    const addItem = (companyId: string) => {
      if (companyId !== '') itemCounts.set(companyId, (itemCounts.get(companyId) ?? 0) + 1);
    };
    products.forEach((p) => addItem(p.companyId));
    listings.forEach((l) => l.offers.forEach((o) => addItem(o.companyId)));

    return {
      tree,
      products,
      companies,
      services,
      listings,
      links,
      ratings: new Map(rawRatings.items ?? []),
      itemCounts,
      counts: loaded
        ? countByCategory(tree, products.map((p) => p.categoryId), listings.map((l) => l.service.categoryId))
        : null,
      vocabulary: [
        ...products.flatMap((p) => [p.name, p.brand]),
        ...services.map((s) => s.name),
        ...companies.map((c) => c.name),
        ...tree.all.map((c) => `${c.name} ${c.nameAr} ${c.nameEn}`),
      ],
      cities,
      cityId,
      profile,
      notifications,
      favorites,
      servingIds,
      loading: !loaded && !(categories.error || rawProducts.error || rawCompanies.error),
      error: categories.error || rawProducts.error || rawCompanies.error,
    };
  }, [categories, rawProducts, rawCompanies, rawServices, rawLinks, rawRatings, cities, cityId, profile, notifications, favorites]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const v = useContext(CatalogContext);
  if (!v) throw new Error('useCatalog outside CatalogProvider');
  return v;
}

/** The signed-in customer, on the pages behind RequireAccount. */
export function useAccount(): UserProfile {
  const { profile } = useCatalog();
  if (!profile) throw new Error('useAccount outside RequireAccount');
  return profile;
}

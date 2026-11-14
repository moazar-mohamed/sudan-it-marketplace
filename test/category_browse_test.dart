import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/category_tree.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_browse.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_service_view.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_pricing.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';

Category _c(String id, String? parent) => Category(
  id: id,
  name: id,
  description: '',
  iconName: '',
  isActive: true,
  createdAt: DateTime(2026),
  parentId: parent,
);

Product _p(
  String id, {
  String brand = '',
  double? price = 100,
  double? offerPrice,
  bool inStock = true,
  String company = 'c1',
}) => Product(
  id: id,
  name: id,
  brand: brand,
  price: price,
  offerPrice: offerPrice,
  offerEndsAt: offerPrice == null ? null : DateTime.now().add(const Duration(days: 1)),
  offerBadge: offerPrice == null ? null : OfferBadge.discount,
  companyId: company,
  inStock: inStock,
  stockCount: inStock ? 3 : 0,
);

ServiceListing _listing(
  String id, {
  double? price,
  double? offerPrice,
  String company = 'c1',
}) {
  final link = CompanyServiceModel(
    id: '${company}_$id',
    companyId: company,
    serviceId: id,
    isActive: true,
    createdAt: DateTime(2026),
    price: price,
    offerPrice: offerPrice,
    offerEndsAt: offerPrice == null ? null : DateTime.now().add(const Duration(days: 1)),
    offerBadge: offerPrice == null ? null : OfferBadge.discount,
  );
  return ServiceListing(
    service: CatalogService(
      id: id,
      categoryId: 'x',
      name: id,
      description: '',
      isActive: true,
      createdAt: DateTime(2026),
    ),
    offers: [link],
    companies: {company: Company(id: company, name: company, rating: 0, reviewCount: 0)},
  );
}

void main() {
  group('counting what each category holds', () {
    final tree = CategoryTree([
      _c('a', null),
      _c('a1', 'a'),
      _c('a1x', 'a1'),
      _c('b', null),
    ]);

    test('a parent counts everything below it', () {
      final counts = countByCategory(
        tree: tree,
        productCategoryIds: ['a1x', 'a1x', 'a', 'b'],
        serviceCategoryIds: ['a1'],
      );
      expect(counts['a1x']?.products, 2);
      expect(counts['a1']?.products, 2);
      expect(counts['a1']?.services, 1);
      expect(counts['a']?.products, 3);
      expect(counts['a']?.total, 4);
      expect(counts['b']?.total, 1);
    });

    test('a category with nothing in it has no entry, so it counts as empty', () {
      final counts = countByCategory(
        tree: tree,
        productCategoryIds: ['a'],
        serviceCategoryIds: const [],
      );
      expect(counts['b'], isNull);
      expect(counts['a1x'], isNull);
      expect(const CategoryCount().isEmpty, isTrue);
    });

    test('items with no category, or one that does not exist, count nowhere', () {
      final counts = countByCategory(
        tree: tree,
        productCategoryIds: [null, 'gone'],
        serviceCategoryIds: [null],
      );
      expect(counts, isEmpty);
    });
  });

  group('filtering products', () {
    final products = [
      _p('a', brand: 'HP', price: 100, offerPrice: 80),
      _p('b', brand: 'hp', price: 300, inStock: false, company: 'c2'),
      _p('c', brand: 'Dell', price: null),
    ];
    List<String> ids(BrowseFilters f) => [
      for (final p in filterProducts(products, f)) p.id,
    ];

    test('with no filter, keeps everything in order', () {
      expect(ids(const BrowseFilters()), ['a', 'b', 'c']);
      expect(const BrowseFilters().isActive, isFalse);
    });

    test('offers, stock, brand and company each narrow the list', () {
      expect(ids(const BrowseFilters(offers: true)), ['a']);
      expect(ids(const BrowseFilters(inStock: true)), ['a', 'c']);
      expect(ids(const BrowseFilters(brand: 'HP')), ['a', 'b']);
      expect(ids(const BrowseFilters(companyId: 'c2')), ['b']);
    });

    test('the price range uses what is charged, and drops unpriced products', () {
      expect(ids(const BrowseFilters(minPrice: 90)), ['b']);
      expect(ids(const BrowseFilters(maxPrice: 90)), ['a']);
      expect(ids(const BrowseFilters(minPrice: 50, maxPrice: 350)), ['a', 'b']);
      expect(const BrowseFilters(minPrice: 1).hasPrice, isTrue);
    });

    test('filters add up', () {
      expect(ids(const BrowseFilters(brand: 'hp', inStock: true)), ['a']);
    });

    test('the "services" kind lists no products', () {
      expect(ids(const BrowseFilters(kind: BrowseKind.services)), isEmpty);
    });
  });

  group('filtering services', () {
    final listings = [
      _listing('s1', price: 100, offerPrice: 70),
      _listing('s2', price: 500, company: 'c2'),
      _listing('s3'),
    ];
    List<String> ids(BrowseFilters f) => [
      for (final l in filterListings(listings, f)) l.service.id,
    ];

    test('offers, company and price narrow the list', () {
      expect(ids(const BrowseFilters()), ['s1', 's2', 's3']);
      expect(ids(const BrowseFilters(offers: true)), ['s1']);
      expect(ids(const BrowseFilters(companyId: 'c2')), ['s2']);
      expect(ids(const BrowseFilters(minPrice: 80)), ['s2']);
      expect(ids(const BrowseFilters(maxPrice: 80)), ['s1']);
    });

    test('brand and stock only exist for products, so they hide the services', () {
      expect(ids(const BrowseFilters(inStock: true)), isEmpty);
      expect(ids(const BrowseFilters(brand: 'HP')), isEmpty);
      expect(ids(const BrowseFilters(kind: BrowseKind.products)), isEmpty);
    });
  });

  group('the filter values', () {
    test('copyWith changes one thing and can clear the others', () {
      const filters = BrowseFilters(offers: true, brand: 'HP', companyId: 'c1');
      expect(filters.copyWith(inStock: true).brand, 'HP');
      expect(filters.copyWith(clearBrand: true).brand, isNull);
      expect(filters.copyWith(clearCompany: true).companyId, isNull);
      expect(filters.withPrice(1, 2).minPrice, 1);
      expect(filters.withPrice(null, null).hasPrice, isFalse);
      // Clearing keeps the kind.
      final cleared = const BrowseFilters(
        kind: BrowseKind.products,
        offers: true,
      ).cleared();
      expect(cleared.kind, BrowseKind.products);
      expect(cleared.isActive, isFalse);
    });
  });

  group('the brands of a list of products', () {
    test('each brand once, spelled as first met, A to Z', () {
      expect(
        brandsOf([
          _p('1', brand: 'Dell'),
          _p('2', brand: ' hp '),
          _p('3', brand: 'HP'),
          _p('4'),
          _p('5', brand: 'cisco'),
        ]),
        ['cisco', 'Dell', 'hp'],
      );
    });
  });
}

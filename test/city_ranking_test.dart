import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/cities/presentation/city_providers.dart';
import 'package:sudan_it_marketplace/features/cities/presentation/city_tags.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_company_view.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_product_view.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Company _company(String id, [List<String> cities = const []]) => Company(
  id: id,
  name: 'Company $id',
  rating: 0,
  reviewCount: 0,
  serviceCityIds: cities,
);

Product _product(String id, String companyId, {DateTime? createdAt}) => Product(
  id: id,
  name: 'Product $id',
  price: 1,
  companyId: companyId,
  createdAt: createdAt,
);

void main() {
  group('the home lists put the companies that serve the city first', () {
    final companies = [
      _company('khartoumCo', ['khartoum']),
      _company('portCo', ['port_sudan']),
      _company('everywhereCo'),
    ];

    test('whatever the sort, the others come after', () {
      for (final sort in CompanySort.values) {
        final ids = viewCompanies(
          companies,
          sort: sort,
          ratings: const {},
          categoriesOf: const {},
          cityId: 'port_sudan',
        ).map((c) => c.id).toList();
        expect(ids.last, 'khartoumCo', reason: '$sort');
        expect(ids.take(2), unorderedEquals(['portCo', 'everywhereCo']));
      }
    });

    test('without a city the sort alone decides', () {
      final ids = viewCompanies(
        companies,
        sort: CompanySort.name,
        ratings: const {},
        categoriesOf: const {},
      ).map((c) => c.id).toList();
      expect(ids, ['everywhereCo', 'khartoumCo', 'portCo']);
    });
  });

  group('the product list', () {
    final older = DateTime(2026, 1, 1);
    final newer = DateTime(2026, 6, 1);
    final products = [
      _product('farNew', 'farCo', createdAt: newer),
      _product('nearOld', 'nearCo', createdAt: older),
    ];
    bool servesNear(Product p) => p.companyId == 'nearCo';

    test('newest order puts the products of the city first', () {
      final ids = viewProducts(
        products,
        sort: ProductSort.newest,
        filters: const ProductFilters(),
        servesCity: servesNear,
      ).map((p) => p.id).toList();
      expect(ids, ['nearOld', 'farNew']);
    });

    test('an order the customer picked is kept as it is', () {
      final ids = viewProducts(
        products,
        sort: ProductSort.priceLow,
        filters: const ProductFilters(),
        servesCity: servesNear,
      ).map((p) => p.id).toList();
      // Equal prices keep the incoming order.
      expect(ids, ['farNew', 'nearOld']);
    });
  });

  testWidgets('a company outside the customer city shows where it serves', (
    tester,
  ) async {
    final far = _company('far', ['port_sudan', 'kassala']);
    final near = _company('near', ['khartoum']);
    final container = ProviderContainer(
      overrides: [
        customerCityIdProvider.overrideWithValue('khartoum'),
        citiesProvider.overrideWith((ref) => const Stream.empty()),
        firestoreCompaniesStreamProvider.overrideWith(
          (ref) => Stream.value([far, near]),
        ),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('en'),
          home: const Scaffold(
            body: Column(
              children: [
                CompanyCityTag(companyId: 'far'),
                CompanyCityTag(companyId: 'near'),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Serves: Port Sudan, Kassala'), findsOneWidget);
    expect(find.byKey(const ValueKey('city-tag-near')), findsNothing);
  });
}

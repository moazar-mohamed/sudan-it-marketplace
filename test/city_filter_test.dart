import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/cities/presentation/city_providers.dart';
import 'package:sudan_it_marketplace/features/cities/domain/sudan_city.dart';
import 'package:sudan_it_marketplace/features/companies/data/models/company_model.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';

Company _company(String id, [List<String> cities = const []]) => Company(
  id: id,
  name: 'Company $id',
  rating: 0,
  reviewCount: 0,
  serviceCityIds: cities,
);

Product _product(String id, String companyId) =>
    Product(id: id, name: 'Product $id', price: 1, companyId: companyId);

void main() {
  group('city list', () {
    test('ids are unique and found by cityById', () {
      final ids = sudanCities.map((c) => c.id).toList();
      expect(ids.toSet().length, ids.length);
      expect(cityById('port_sudan')?.nameAr, 'بورتسودان');
      expect(cityById('nowhere'), isNull);
      expect(cityById(null), isNull);
    });

    test('normalizeCityIds keeps each id once, list cities first in list order', () {
      expect(
        normalizeCityIds(['bahri', 'khartoum', 'mars', 'bahri', 5, null]),
        ['khartoum', 'bahri', 'mars'],
      );
    });

    test('cityNamesText joins names in the language', () {
      expect(cityNamesText(['khartoum', 'omdurman'], 'ar'), 'الخرطوم، أم درمان');
      expect(cityNamesText(['khartoum', 'omdurman'], 'en'), 'Khartoum, Omdurman');
    });
  });

  group('a company serves a city', () {
    test('a company with no cities serves every city', () {
      expect(_company('a').servesCity('nyala'), isTrue);
    });

    test('a company with cities serves only those', () {
      final company = _company('a', ['khartoum', 'omdurman']);
      expect(company.servesCity('khartoum'), isTrue);
      expect(company.servesCity('port_sudan'), isFalse);
    });

    test('a customer with no city is not restricted', () {
      expect(_company('a', ['khartoum']).servesCity(null), isTrue);
    });

    test('the stored list is read and cleaned', () {
      final company = CompanyModel.fromMap('c1', {
        'name': 'X',
        'serviceCityIds': ['bahri', 'mars', 'khartoum'],
      });
      expect(company.serviceCityIds, ['khartoum', 'bahri', 'mars']);
      expect(CompanyModel.fromMap('c2', {'name': 'Y'}).serviceCityIds, isEmpty);
      expect(CompanyModel.toEditableFields(company)['serviceCityIds'], [
        'khartoum',
        'bahri',
        'mars',
      ]);
    });
  });

  group('marketplace lists follow the customer city', () {
    final companies = [
      _company('khartoumCo', ['khartoum']),
      _company('portCo', ['port_sudan']),
      _company('everywhereCo'),
    ];

    test('companies serving the city stay', () {
      expect(
        companiesServingCity(companies, 'khartoum').map((c) => c.id),
        ['khartoumCo', 'everywhereCo'],
      );
      expect(companiesServingCity(companies, null), hasLength(3));
    });

    test('companies serving the city come first, the others after them', () {
      expect(
        companiesServingCityFirst(companies, 'port_sudan').map((c) => c.id),
        ['portCo', 'everywhereCo', 'khartoumCo'],
      );
      expect(
        companiesServingCityFirst(companies, 'khartoum').map((c) => c.id),
        ['khartoumCo', 'everywhereCo', 'portCo'],
      );
      // No city: nothing is moved.
      expect(
        companiesServingCityFirst(companies, null).map((c) => c.id),
        ['khartoumCo', 'portCo', 'everywhereCo'],
      );
    });

    test('products of companies that do not serve the city come last', () {
      final products = [
        _product('p1', 'khartoumCo'),
        _product('p2', 'portCo'),
        _product('p3', 'everywhereCo'),
      ];
      // Nothing is hidden: p1 stays, after the ones that serve Port Sudan.
      expect(
        productsOfActiveCompanies(
          products,
          companies,
          cityId: 'port_sudan',
        ).map((p) => p.id),
        ['p2', 'p3', 'p1'],
      );
      expect(
        productsOfActiveCompanies(products, companies).map((p) => p.id),
        ['p1', 'p2', 'p3'],
      );
    });

    test('products of an inactive company are still hidden', () {
      final withInactive = [
        ...companies,
        const Company(
          id: 'offCo',
          name: 'Off',
          rating: 0,
          reviewCount: 0,
          status: 'deactivated',
        ),
      ];
      expect(
        productsOfActiveCompanies(
          [_product('p1', 'offCo'), _product('p2', 'portCo')],
          withInactive,
          cityId: 'port_sudan',
        ).map((p) => p.id),
        ['p2'],
      );
    });
  });

  group('companyServesMyCityProvider', () {
    bool serves(String? myCity, Company? company) {
      final container = ProviderContainer(
        overrides: [
          customerCityIdProvider.overrideWithValue(myCity),
          resolvedCompanyProvider('c1').overrideWithValue(company),
        ],
      );
      addTearDown(container.dispose);
      return container.read(companyServesMyCityProvider('c1'));
    }

    test('false only when the company lists cities without mine', () {
      final company = _company('c1', ['khartoum']);
      expect(serves('port_sudan', company), isFalse);
      expect(serves('khartoum', company), isTrue);
      expect(serves(null, company), isTrue);
      expect(serves('port_sudan', _company('c1')), isTrue);
      expect(serves('port_sudan', null), isTrue);
    });

    test('the delivery city the customer chose counts instead of their own', () {
      final company = _company('c1', ['port_sudan']);
      final container = ProviderContainer(
        overrides: [
          customerCityIdProvider.overrideWithValue('khartoum'),
          resolvedCompanyProvider('c1').overrideWithValue(company),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(companyServesMyCityProvider('c1')), isFalse);
      container.read(deliveryCityOverrideProvider.notifier).set('port_sudan');
      expect(container.read(deliveryCityIdProvider), 'port_sudan');
      expect(container.read(companyServesMyCityProvider('c1')), isTrue);
      container.read(deliveryCityOverrideProvider.notifier).set(null);
      expect(container.read(deliveryCityIdProvider), 'khartoum');
    });
  });
}

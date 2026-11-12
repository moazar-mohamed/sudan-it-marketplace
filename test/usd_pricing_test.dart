import 'helpers/field_finders.dart';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/services/image_upload_service.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_picker.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/payment_account.dart';
import 'package:sudan_it_marketplace/features/companies/domain/repositories/companies_repository.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/dashboard/usd_rate_card.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/products/product_form_screen.dart';
import 'package:sudan_it_marketplace/features/products/data/models/product_model.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/repositories/products_repository.dart';
import 'package:sudan_it_marketplace/features/products/domain/usd_pricing.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/usd_format.dart';
import 'package:sudan_it_marketplace/features/push/domain/push_categories.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_preference.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _en = Locale('en');
const _ar = Locale('ar');

Product _usd({
  String id = 'p1',
  double priceUsd = 250,
  double rate = 3000,
  double? offerUsd,
  double? offerPrice,
  bool installation = false,
  double? installationUsd,
}) =>
    Product(
      id: id,
      name: 'Laptop $id',
      companyId: 'c1',
      price: UsdPricing.price(priceUsd, rate),
      priceUsd: priceUsd,
      usdRateApplied: rate,
      offerPriceUsd: offerUsd,
      offerPrice: offerPrice ?? (offerUsd == null ? null : UsdPricing.offer(offerUsd, rate)),
      isInstallationAvailable: installation,
      installationPriceUsd: installationUsd,
      installationPrice: installationUsd == null ? null : UsdPricing.price(installationUsd, rate),
    );

Company _company({double? rate, DateTime? updatedAt}) => Company(
      id: 'c1',
      name: 'Sudan Print Hub',
      rating: 0,
      reviewCount: 0,
      usdRate: rate,
      usdRateUpdatedAt: updatedAt,
    );

class _RecordingCompanies extends Fake implements CompaniesRepository {
  final rates = <({String companyId, double rate, Map<String, Map<String, Object?>> repricing})>[];
  final repriced = <Map<String, Map<String, Object?>>>[];

  @override
  Future<void> setUsdRate(
    String companyId,
    double rate,
    Map<String, Map<String, Object?>> repricing,
  ) async =>
      rates.add((companyId: companyId, rate: rate, repricing: repricing));

  @override
  Future<void> repriceProducts(Map<String, Map<String, Object?>> repricing) async =>
      repriced.add(repricing);

  @override
  Stream<Company?> watchCompany(String companyId) => Stream.value(null);

  @override
  Future<void> updatePaymentAccounts(String companyId, List<PaymentAccount> accounts) async {}
}

class _RecordingProducts extends Fake implements ProductsRepository {
  final created = <Product>[];

  @override
  String newProductId() => 'new1';

  @override
  Future<void> createProduct(Product product) async => created.add(product);
}

class _FakeStorage extends Fake implements FirebaseStorage {}

Widget _app(Widget home, {Locale locale = _en, List overrides = const []}) {
  return ProviderScope(
    // ignore: argument_type_not_assignable
    overrides: overrides.cast(),
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [_en, _ar],
      home: home,
    ),
  );
}

void main() {
  group('who sees the dollar-rate card', () {
    test('a company that never chose dollar pricing does not', () {
      expect(UsdPricing.usesDollars(null, null), isFalse);
      expect(UsdPricing.usesDollars(null, const <Product>[]), isFalse);
      expect(UsdPricing.usesDollars(null, [const Product(id: 'p', name: 'Cable', companyId: 'c1')]), isFalse);
    });

    test('one with a rate or a product priced in dollars does', () {
      expect(UsdPricing.usesDollars(2500, null), isTrue);
      expect(UsdPricing.usesDollars(2500, const <Product>[]), isTrue);
      expect(UsdPricing.usesDollars(null, [_usd()]), isTrue);
    });
  });

  group('the sums', () {
    test('a price rounds UP to the next 500 pounds', () {
      expect(UsdPricing.price(99, 3170), 314000);
      expect(UsdPricing.price(250, 3170), 792500);
      expect(UsdPricing.price(12.5, 3170), 40000);
      expect(UsdPricing.price(250, 3000), 750000);
    });

    test('an exact sum is not pushed up by floating point', () {
      // 1.1 x 5000 is 5500.000000000001 in floating point.
      expect(UsdPricing.price(1.1, 5000), 5500);
      expect(UsdPricing.offer(1.1, 5000), 5500);
    });

    test('an offer rounds DOWN, never below 500', () {
      expect(UsdPricing.offer(89, 3170), 282000);
      expect(UsdPricing.offer(0.01, 3000), 500);
    });

    test('an offer below the price in dollars stays below it in pounds', () {
      for (final rate in [1.0, 2.5, 999.0, 3000.0, 3170.0, 7000.0, 12345.67]) {
        for (final price in [0.2, 1.0, 9.99, 99.0, 250.0, 1234.56]) {
          final offer = price - 0.01;
          if (offer <= 0) continue;
          final pounds = UsdPricing.price(price, rate);
          final offerPounds = UsdPricing.offer(offer, rate);
          if (pounds > UsdPricing.step) {
            expect(offerPounds, lessThan(pounds), reason: '$offer < $price at $rate');
          }
        }
      }
    });

    test('a rate must be between 1 and 1,000,000', () {
      expect(UsdPricing.isValidRate(3000), isTrue);
      expect(UsdPricing.isValidRate(1), isTrue);
      expect(UsdPricing.isValidRate(0), isFalse);
      expect(UsdPricing.isValidRate(null), isFalse);
      expect(UsdPricing.isValidRate(2000000), isFalse);
    });

    test('a jump of more than 20% asks first', () {
      expect(UsdPricing.isBigChange(3000, 3500), isFalse);
      expect(UsdPricing.isBigChange(3000, 3700), isTrue);
      expect(UsdPricing.isBigChange(3000, 30000), isTrue);
      expect(UsdPricing.isBigChange(null, 30000), isFalse);
    });

    test('the age of a rate: fresh, a day old, two days old', () {
      final now = DateTime(2026, 11, 5, 12);
      expect(UsdPricing.ageOf(now.subtract(const Duration(hours: 23)), now), UsdRateAge.fresh);
      expect(UsdPricing.ageOf(now.subtract(const Duration(hours: 24)), now), UsdRateAge.due);
      expect(UsdPricing.ageOf(now.subtract(const Duration(hours: 48)), now), UsdRateAge.stale);
      expect(UsdPricing.ageOf(null, now), UsdRateAge.stale);
    });

    test('dollar amounts read the way the company typed them', () {
      expect(formatUsdAmount(250), '250');
      expect(formatUsdAmount(12.5), '12.5');
      expect(formatUsdAmount(3250.75), '3,250.75');
      expect(usdAmountInputText(3250.5), '3250.5');
    });
  });

  group('repricing a product', () {
    test('only dollar products that do not use the rate yet', () {
      expect(UsdPricing.needsRepricing(_usd(rate: 3000), 3000), isFalse);
      expect(UsdPricing.needsRepricing(_usd(rate: 3000), 3200), isTrue);
      const pounds = Product(id: 'x', name: 'x', price: 100);
      expect(UsdPricing.needsRepricing(pounds, 3200), isFalse);
    });

    test('the price and the rate it uses', () {
      final fields = UsdPricing.repricedFields(_usd(), 3200);
      expect(fields['price'], 800000);
      expect(fields['usdRateApplied'], 3200);
      expect(fields.containsKey('offerPrice'), isFalse);
    });

    test('a dollar offer and a dollar installation price follow the rate', () {
      final fields = UsdPricing.repricedFields(
        _usd(offerUsd: 229, installation: true, installationUsd: 15),
        3200,
      );
      expect(fields['offerPrice'], 732500);
      expect(fields['installationPrice'], 48000);
    });

    test('an offer made in pounds keeps its share of the price', () {
      // 750,000 with a 600,000 offer: 80% of the price.
      final fields = UsdPricing.repricedFields(_usd(offerPrice: 600000), 3200);
      expect(fields['offerPrice'], 640000);
    });

    test('an offer too close to the price ends instead of blocking the rewrite', () {
      final fields = UsdPricing.repricedFields(
        _usd(priceUsd: 0.2, offerUsd: 0.19, rate: 3000),
        2500,
      );
      expect(fields['price'], 500);
      expect(fields['offerPrice'], isNull);
      expect(fields['offerPriceUsd'], isNull);
    });

    test('a dollar offer whose pounds were taken off is dropped', () {
      final product = Product(
        id: 'p1',
        name: 'Laptop',
        price: 750000,
        priceUsd: 250,
        usdRateApplied: 3000,
        offerPriceUsd: 200,
      );
      expect(UsdPricing.repricedFields(product, 3200)['offerPriceUsd'], isNull);
    });
  });

  group('the stored product', () {
    test('a dollar product saves its dollars beside the pounds', () {
      final fields = ProductModel.toFirestoreFields(_usd(offerUsd: 229));
      expect(fields['price'], 750000);
      expect(fields['priceUsd'], 250);
      expect(fields['offerPriceUsd'], 229);
      expect(fields['usdRateApplied'], 3000);
      expect(fields['currency'], 'SDG');
    });

    test('a product in pounds stores no dollars', () {
      final fields = ProductModel.toFirestoreFields(
        const Product(id: 'x', name: 'x', price: 100),
      );
      expect(fields['priceUsd'], isNull);
      expect(fields['usdRateApplied'], isNull);
      expect(fields['offerPriceUsd'], isNull);
      expect(fields['installationPriceUsd'], isNull);
    });
  });

  group('the dollar rate card', () {
    late _RecordingCompanies companies;

    setUp(() => companies = _RecordingCompanies());

    Future<void> pumpCard(
      WidgetTester tester, {
      required Company company,
      List<Product> products = const [],
      Locale locale = _en,
    }) async {
      await tester.pumpWidget(
        _app(
          Scaffold(
            body: SingleChildScrollView(
              child: UsdRateCard(companyId: 'c1', company: company, products: products),
            ),
          ),
          locale: locale,
          overrides: [
            companiesRepositoryProvider.overrideWithValue(companies),
            pushPrefsProvider.overrideWith((ref) => Stream.value(const PushPrefs())),
            currentUserIdProvider.overrideWith((ref) => 'ca1'),
          ],
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('a company without a rate is asked to set one', (tester) async {
      await pumpCard(tester, company: _company());
      expect(find.text('Set your dollar rate'), findsOneWidget);
      expect(find.text('Set the rate'), findsOneWidget);
    });

    testWidgets('shows the rate, when it was set and the dollar products', (tester) async {
      await pumpCard(
        tester,
        company: _company(rate: 3000, updatedAt: DateTime.now()),
        products: [_usd(), _usd(id: 'p2')],
      );
      expect(find.text(r'$1 = 3,000 SDG'), findsOneWidget);
      expect(find.textContaining('Updated today'), findsOneWidget);
      expect(find.text('2 products in dollars'), findsOneWidget);
      expect(find.textContaining('may be wrong'), findsNothing);
    });

    testWidgets('a day old: time to update; two days old: the prices may be wrong',
        (tester) async {
      await pumpCard(
        tester,
        company: _company(rate: 3000, updatedAt: DateTime.now().subtract(const Duration(hours: 30))),
        products: [_usd()],
      );
      expect(find.text('Time to update the dollar rate'), findsOneWidget);

      await pumpCard(
        tester,
        company: _company(rate: 3000, updatedAt: DateTime.now().subtract(const Duration(days: 3))),
        products: [_usd()],
      );
      expect(find.textContaining('may be wrong'), findsOneWidget);
      expect(find.text('Last updated 3 days ago'), findsOneWidget);
    });

    testWidgets('a company that does not sell in dollars is never warned', (tester) async {
      await pumpCard(
        tester,
        company: _company(rate: 3000, updatedAt: DateTime.now().subtract(const Duration(days: 5))),
        products: const [Product(id: 'x', name: 'x', price: 100)],
      );
      expect(find.textContaining('may be wrong'), findsNothing);
    });

    testWidgets('"Same rate" confirms the rate it has', (tester) async {
      await pumpCard(
        tester,
        company: _company(rate: 3000, updatedAt: DateTime.now().subtract(const Duration(days: 1))),
        products: [_usd()],
      );
      await tester.tap(find.byKey(const ValueKey('usd-rate-same')));
      await tester.pumpAndSettle();
      expect(companies.rates.single.rate, 3000);
      // Every product already uses it: nothing to rewrite.
      expect(companies.rates.single.repricing, isEmpty);
      expect(find.text('Dollar rate confirmed.'), findsOneWidget);
    });

    testWidgets('a new rate shows what changes, and rewrites the dollar products',
        (tester) async {
      await pumpCard(
        tester,
        company: _company(rate: 3000, updatedAt: DateTime.now()),
        products: [_usd(), const Product(id: 'sdg', name: 'Cable', price: 5000)],
      );
      await tester.tap(find.byKey(const ValueKey('usd-rate-edit')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('usd-rate-field')), '3200');
      await tester.pumpAndSettle();
      expect(find.textContaining('1 product price will change'), findsOneWidget);
      expect(find.textContaining('750,000 → 800,000'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('usd-rate-save')));
      await tester.pumpAndSettle();
      final saved = companies.rates.single;
      expect(saved.rate, 3200);
      expect(saved.repricing.keys, ['p1']);
      expect(saved.repricing['p1']!['price'], 800000);
      expect(find.text('Dollar rate saved.'), findsOneWidget);
    });

    testWidgets('a big jump asks first, and nothing is saved when the company says no',
        (tester) async {
      await pumpCard(
        tester,
        company: _company(rate: 3000, updatedAt: DateTime.now()),
        products: [_usd()],
      );
      await tester.tap(find.byKey(const ValueKey('usd-rate-edit')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('usd-rate-field')), '30000');
      await tester.tap(find.byKey(const ValueKey('usd-rate-save')));
      await tester.pumpAndSettle();
      expect(find.text('Is this rate right?'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(companies.rates, isEmpty);
    });

    testWidgets('the reminder switch is in the rate window', (tester) async {
      await pumpCard(tester, company: _company(rate: 3000, updatedAt: DateTime.now()));
      await tester.tap(find.byKey(const ValueKey('usd-rate-edit')));
      await tester.pumpAndSettle();
      expect(find.text('Remind me to update the dollar rate'), findsOneWidget);
      expect(
        tester.widget<SwitchListTile>(find.byKey(const ValueKey('usd-rate-reminder'))).value,
        isTrue,
      );
    });

    testWidgets('a rewrite cut short is finished when the card sees it', (tester) async {
      await pumpCard(
        tester,
        company: _company(rate: 3200, updatedAt: DateTime.now()),
        products: [_usd(rate: 3000), _usd(id: 'p2', rate: 3200)],
      );
      expect(companies.repriced.single.keys, ['p1']);
    });

    testWidgets('reads in Arabic', (tester) async {
      await pumpCard(
        tester,
        company: _company(rate: 3000, updatedAt: DateTime.now()),
        products: [_usd()],
        locale: _ar,
      );
      expect(find.text('سعر الدولار'), findsOneWidget);
      expect(find.text('السعر نفسه'), findsOneWidget);
      expect(find.text('منتج واحد بالدولار'), findsOneWidget);
    });
  });

  group('the product form in dollars', () {
    late _RecordingProducts repository;

    setUp(() => repository = _RecordingProducts());

    Future<void> openForm(WidgetTester tester, {double? rate}) async {
      tester.view.physicalSize = const Size(800, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        _app(
          Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const ProductFormScreen.add(companyId: 'c1'),
                ),
              ),
              child: const Text('open'),
            ),
          ),
          overrides: [
            productsRepositoryProvider.overrideWithValue(repository),
            imageUploadServiceProvider.overrideWithValue(
              ImageUploadService(storage: _FakeStorage()),
            ),
            companyStreamProvider.overrideWith(
              (ref, id) => Stream.value(_company(rate: rate, updatedAt: DateTime.now())),
            ),
            companyProductsStreamProvider.overrideWith((ref, id) => Stream.value(const [])),
            allCategoriesProvider.overrideWith(
              (ref) => Stream.value([
                Category(
                  id: 'cat1',
                  name: 'Laptops',
                  description: '',
                  iconName: '',
                  isActive: true,
                  createdAt: DateTime(2026),
                ),
              ]),
            ),
          ],
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
    }

    Future<void> fillInDollars(WidgetTester tester, String usd) async {
      await tester.enterText(fieldWithLabel('Product Name'), 'Dell Laptop');
      await tester.tap(find.text('Dollars'));
      await tester.pumpAndSettle();
      await tester.enterText(fieldWithLabel(r'Price ($)'), usd);
      await tester.enterText(fieldWithLabel('Stock Quantity'), '4');
      await tester.tap(find.byType(CategoryPickerField));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Laptops').last);
      await tester.pumpAndSettle();
    }

    testWidgets('the pounds show under the dollars and are saved beside them',
        (tester) async {
      await openForm(tester, rate: 3170);
      await fillInDollars(tester, '99');
      expect(find.text(r'= 314,000 SDG at $1 = 3,170'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Add Product'));
      await tester.pumpAndSettle();
      final saved = repository.created.single;
      expect(saved.priceUsd, 99);
      expect(saved.price, 314000);
      expect(saved.usdRateApplied, 3170);
      expect(saved.currency, 'SDG');
    });

    testWidgets('without a rate the company is asked to set one first', (tester) async {
      await openForm(tester);
      await fillInDollars(tester, '99');
      expect(find.byKey(const ValueKey('price-needs-rate')), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Add Product'));
      await tester.pumpAndSettle();
      expect(repository.created, isEmpty);
    });

    testWidgets('a price in dollars is needed', (tester) async {
      await openForm(tester, rate: 3000);
      await fillInDollars(tester, '');
      await tester.tap(find.widgetWithText(FilledButton, 'Add Product'));
      await tester.pumpAndSettle();
      expect(find.text('Enter the price in dollars.'), findsOneWidget);
      expect(repository.created, isEmpty);
    });
  });

  test('the reminder is a push kind of its own, on until switched off', () {
    expect(const PushPrefs().isOn(PushCategory.usdRate), isTrue);
    expect(
      const PushPrefs().withKind(PushCategory.usdRate, enabled: false).isOn(PushCategory.usdRate),
      isFalse,
    );
  });
}

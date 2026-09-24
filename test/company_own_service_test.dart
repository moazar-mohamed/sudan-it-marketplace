import 'helpers/field_finders.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/company_admin_actions.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/services/my_services_view.dart';
import 'package:sudan_it_marketplace/features/company_services/domain/entities/company_service.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _en = Locale('en');
final _created = DateTime(2026);

Category _category(String id, String name, {bool isActive = true}) => Category(
      id: id,
      name: name,
      description: '',
      iconName: '',
      isActive: isActive,
      createdAt: _created,
    );

CatalogService _service(String id, String name, {String? owner}) =>
    CatalogService(
      id: id,
      categoryId: 'cat1',
      name: name,
      description: 'About $name',
      isActive: true,
      createdAt: _created,
      ownerCompanyId: owner,
    );

class _RecordingActions extends Fake implements CompanyAdminActions {
  final created = <Map<String, Object?>>[];
  final updated = <Map<String, Object?>>[];
  final removedOwn = <String>[];

  @override
  Future<String?> createOwnService({
    required String companyId,
    required String categoryId,
    required String name,
    required String description,
    double? price,
    String? note,
  }) async {
    created.add({
      'companyId': companyId,
      'categoryId': categoryId,
      'name': name,
      'description': description,
      'price': price,
      'note': note,
    });
    return null;
  }

  @override
  Future<String?> updateOwnService({
    required String companyServiceId,
    required String serviceId,
    required String categoryId,
    required String name,
    required String description,
    double? price,
    String? note,
  }) async {
    updated.add({
      'companyServiceId': companyServiceId,
      'serviceId': serviceId,
      'categoryId': categoryId,
      'name': name,
      'price': price,
    });
    return null;
  }

  @override
  Future<String?> removeOwnService({
    required String companyId,
    required String serviceId,
  }) async {
    removedOwn.add(serviceId);
    return null;
  }
}

Widget _app(
  _RecordingActions actions, {
  List<CompanyService> offered = const [],
  List<CatalogService> catalogue = const [],
}) {
  return ProviderScope(
    overrides: [
      companyAdminActionsProvider.overrideWithValue(actions),
      activeServicesForCompanyProvider('c1')
          .overrideWith((ref) => Stream.value(offered)),
      marketplaceServicesProvider
          .overrideWithValue(AsyncValue.data(catalogue)),
      allServicesProvider(null).overrideWith((ref) => Stream.value(catalogue)),
      allCategoriesProvider.overrideWith(
        (ref) => Stream.value([
          _category('cat1', 'Networking'),
          _category('cat2', 'Security'),
          _category('cat3', 'Retired', isActive: false),
        ]),
      ),
    ],
    child: MaterialApp(
      locale: _en,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [_en, Locale('ar')],
      home: const Scaffold(body: MyServicesView(companyId: 'c1')),
    ),
  );
}

CompanyService _link(String serviceId, {double? price}) => CompanyService(
      id: 'c1_$serviceId',
      companyId: 'c1',
      serviceId: serviceId,
      isActive: true,
      createdAt: _created,
      price: price,
    );

void main() {
  void useTallScreen(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 3200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  testWidgets('an empty company can create its first service', (tester) async {
    useTallScreen(tester);
    final actions = _RecordingActions();
    await tester.pumpWidget(_app(actions));
    await tester.pumpAndSettle();

    expect(find.text('Create your first service'), findsOneWidget);
    await tester.tap(find.text('Create your first service'));
    await tester.pumpAndSettle();

    await tester.enterText(
      fieldWithLabel('Service name'),
      'CCTV installation',
    );
    await tester.enterText(
      fieldWithLabel('Description'),
      'Cameras and cabling',
    );
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    // Only active categories are offered.
    expect(find.text('Retired'), findsNothing);
    await tester.tap(find.text('Security').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      fieldWithLabel('Price (SDG) - optional'),
      '150000',
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();

    expect(actions.created, hasLength(1));
    final call = actions.created.single;
    expect(call['companyId'], 'c1');
    expect(call['categoryId'], 'cat2');
    expect(call['name'], 'CCTV installation');
    expect(call['description'], 'Cameras and cabling');
    expect(call['price'], 150000);
  });

  testWidgets('name and category are required', (tester) async {
    useTallScreen(tester);
    final actions = _RecordingActions();
    await tester.pumpWidget(_app(actions));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Create your first service'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();

    expect(find.text('Service name is required.'), findsOneWidget);
    expect(find.text('Choose a category.'), findsOneWidget);
    expect(actions.created, isEmpty);
  });

  testWidgets('an own service can be edited and removed', (tester) async {
    useTallScreen(tester);
    final actions = _RecordingActions();
    final own = _service('s1', 'Wi-Fi setup', owner: 'c1');
    await tester.pumpWidget(
      _app(
        actions,
        offered: [_link('s1', price: 5000)],
        catalogue: [own],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Wi-Fi setup'), findsOneWidget);
    expect(find.textContaining('Created by you'), findsOneWidget);

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Edit').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      fieldWithLabel('Service name'),
      'Wi-Fi setup pro',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();

    expect(actions.updated, hasLength(1));
    expect(actions.updated.single['serviceId'], 's1');
    expect(actions.updated.single['name'], 'Wi-Fi setup pro');
    expect(actions.updated.single['price'], 5000);

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Remove'));
    await tester.pumpAndSettle();

    expect(actions.removedOwn, ['s1']);
  });

  testWidgets("another company's service is not offered for adding",
      (tester) async {
    useTallScreen(tester);
    final actions = _RecordingActions();
    await tester.pumpWidget(
      _app(
        actions,
        catalogue: [
          _service('platform1', 'Platform service'),
          _service('theirs', 'Rival service', owner: 'c2'),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Platform service'), findsOneWidget);
    expect(find.text('Rival service'), findsNothing);
  });
}

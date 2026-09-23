import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/company_admin_shell.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/service_requests/presentation/service_request_providers.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/features/technicians/domain/entities/technician.dart';
import 'package:sudan_it_marketplace/features/technicians/presentation/technicians_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _companyId = 'c1';

Widget _shell({Locale locale = const Locale('en')}) {
  return ProviderScope(
    overrides: [
      companyStreamProvider(_companyId).overrideWith(
        (_) => Stream.value(const Company(
          id: _companyId,
          name: 'Acme IT',
          rating: 0,
          reviewCount: 0,
        )),
      ),
      companyProductsStreamProvider(_companyId)
          .overrideWith((_) => Stream.value(const [])),
      companyOrdersStreamProvider(_companyId)
          .overrideWith((_) => Stream.value(const [])),
      companyTechniciansStreamProvider(_companyId).overrideWith(
        (_) => Stream.value(const [
          Technician(id: 't1', companyId: _companyId, fullName: 'Tech One'),
        ]),
      ),
      companyServiceRequestsStreamProvider(_companyId)
          .overrideWith((_) => Stream.value(const [])),
      companyChatsStreamProvider(_companyId)
          .overrideWith((_) => Stream.value(const [])),
      activeServicesForCompanyProvider(_companyId)
          .overrideWith((_) => Stream.value(const [])),
      allServicesProvider(null).overrideWith((_) => Stream.value(const [])),
      activeServicesProvider(null).overrideWith((_) => Stream.value(const [])),
      allCategoriesProvider.overrideWith((_) => Stream.value(const [])),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: const CompanyAdminShell(companyId: _companyId),
    ),
  );
}

void main() {
  // A small phone: 360 logical pixels wide.
  void usePhone(WidgetTester tester) {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  testWidgets('the bottom bar has five destinations and does not overflow',
      (tester) async {
    usePhone(tester);
    await tester.pumpWidget(_shell());
    await tester.pumpAndSettle();

    expect(find.byType(NavigationDestination), findsNWidgets(5));
    expect(tester.takeException(), isNull);
    expect(find.text('Company Dashboard'), findsWidgets);
  });

  testWidgets('More reaches Installations, Technicians and the company profile',
      (tester) async {
    usePhone(tester);
    await tester.pumpWidget(_shell());
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.menu_rounded));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ListTile, 'Installations'), findsOneWidget);
    expect(find.widgetWithText(ListTile, 'Technicians'), findsOneWidget);
    expect(find.widgetWithText(ListTile, 'Company Profile'), findsOneWidget);

    await tester.tap(find.widgetWithText(ListTile, 'Technicians'));
    await tester.pumpAndSettle();
    // The Technicians section is open, and "More" is the selected slot.
    expect(find.text('Tech One'), findsOneWidget);
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.selectedIndex, 4);

    // The main sections are still one tap away.
    await tester.tap(find.byIcon(Icons.receipt_long_outlined));
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      2,
    );
  });

  testWidgets('the bar and More sheet are translated and right-to-left in Arabic',
      (tester) async {
    usePhone(tester);
    await tester.pumpWidget(_shell(locale: const Locale('ar')));
    await tester.pumpAndSettle();

    expect(
      Directionality.of(tester.element(find.byType(NavigationBar))),
      TextDirection.rtl,
    );
    await tester.tap(find.byIcon(Icons.menu_rounded));
    await tester.pumpAndSettle();
    expect(find.text('الفنيون'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

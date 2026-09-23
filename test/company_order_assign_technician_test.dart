import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/orders/company_order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/technicians/domain/entities/technician.dart';
import 'package:sudan_it_marketplace/features/technicians/presentation/technicians_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

OrderEntity _order({required bool installation}) => OrderEntity(
      id: 'order1234',
      customerId: 'cust1',
      companyId: 'c1',
      productId: 'p1',
      productName: 'lenovo',
      quantity: 1,
      unitPrice: 100000,
      productSubtotal: 100000,
      installationSelected: installation,
      installationFee: installation ? 10 : 0,
      deliveryFee: 15000,
      totalAmount: 115010,
      deliveryAddress: 'ghj',
      contactPhone: '0912345678',
      createdAt: DateTime(2026, 9, 20),
    );

Widget _screen(OrderEntity order, List<Technician> technicians) {
  return ProviderScope(
    overrides: [
      companyOrdersStreamProvider('c1').overrideWith((_) => Stream.value([order])),
      companyTechniciansStreamProvider('c1')
          .overrideWith((_) => Stream.value(technicians)),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: [Locale('en'), Locale('ar')],
      locale: Locale('en'),
      home: CompanyOrderDetailsScreen(companyId: 'c1', orderId: 'order1234'),
    ),
  );
}

const _tech = Technician(id: 't1', companyId: 'c1', fullName: 'Test Technician');

void main() {
  testWidgets('an order with installation lets the company assign a technician',
      (tester) async {
    await tester.pumpWidget(_screen(_order(installation: true), [_tech]));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Assign Technician'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Assign Technician'), findsOneWidget);
    expect(find.text('Not assigned'), findsOneWidget);

    await tester.tap(find.text('Assign Technician'));
    await tester.pumpAndSettle();
    // The company's own technicians are offered in the picker.
    expect(find.text('Test Technician'), findsOneWidget);
  });

  testWidgets('an order without installation has no technician section',
      (tester) async {
    await tester.pumpWidget(_screen(_order(installation: false), [_tech]));
    await tester.pumpAndSettle();

    expect(find.text('Assign Technician'), findsNothing);
    expect(find.text('Not assigned'), findsNothing);
  });
}

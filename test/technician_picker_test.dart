import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/widgets/technician_picker_sheet.dart';
import 'package:sudan_it_marketplace/features/technicians/domain/entities/technician.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Technician _t(
  String id,
  String name, {
  String phone = '',
  bool active = true,
}) => Technician(
  id: id,
  companyId: 'c1',
  fullName: name,
  phone: phone,
  isActive: active,
);

final _few = [
  _t('t1', 'Abas', phone: '0912345678'),
  _t('t2', 'Test.technician'),
];

final _many = [
  for (var i = 1; i <= 8; i++) _t('m$i', 'Tech $i', phone: '09000000$i'),
  _t('ar', 'أحمد علي'),
];

void main() {
  Technician? chosen;
  var dismissed = false;

  Future<void> open(
    WidgetTester tester,
    List<Technician> technicians, {
    String? assignedId,
    Locale locale = const Locale('en'),
  }) async {
    chosen = null;
    dismissed = false;
    tester.view.physicalSize = const Size(800, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: const [Locale('en'), Locale('ar')],
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                final result = await showTechnicianPicker(
                  context,
                  technicians: technicians,
                  assignedId: assignedId,
                );
                chosen = result;
                dismissed = result == null;
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  testWidgets('lists every technician as a card with name and phone', (
    tester,
  ) async {
    await open(tester, _few);
    expect(find.text('Assign Technician'), findsOneWidget);
    expect(
      find.text('Choose who will carry out this installation.'),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('technician-t1')), findsOneWidget);
    expect(find.byKey(const ValueKey('technician-t2')), findsOneWidget);
    expect(find.text('Abas'), findsOneWidget);
    expect(find.text('0912345678'), findsOneWidget);
    // a short list needs no search box
    expect(find.byKey(const ValueKey('technician-search')), findsNothing);
  });

  testWidgets('tapping a technician returns that technician', (tester) async {
    await open(tester, _few);
    await tester.tap(find.byKey(const ValueKey('technician-t2')));
    await tester.pumpAndSettle();
    expect(chosen?.id, 't2');
    expect(find.text('Assign Technician'), findsNothing); // the sheet closed
  });

  testWidgets('the technician already assigned is marked', (tester) async {
    await open(tester, _few, assignedId: 't1');
    final marked = find.descendant(
      of: find.byKey(const ValueKey('technician-t1')),
      matching: find.text('Assigned'),
    );
    expect(marked, findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('technician-t2')),
        matching: find.text('Assigned'),
      ),
      findsNothing,
    );
  });

  testWidgets('dismissing the sheet chooses nobody', (tester) async {
    await open(tester, _few);
    await tester.tapAt(const Offset(20, 20)); // the scrim above the sheet
    await tester.pumpAndSettle();
    expect(dismissed, isTrue);
    expect(chosen, isNull);
  });

  testWidgets('a long list gets a search box that filters by name or phone', (
    tester,
  ) async {
    await open(tester, _many);
    final search = find.byKey(const ValueKey('technician-search'));
    expect(search, findsOneWidget);

    await tester.enterText(
      find.descendant(of: search, matching: find.byType(TextField)),
      'tech 3',
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('technician-m3')), findsOneWidget);
    expect(find.byKey(const ValueKey('technician-m4')), findsNothing);

    await tester.enterText(
      find.descendant(of: search, matching: find.byType(TextField)),
      '090000005',
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('technician-m5')), findsOneWidget);
    expect(find.byKey(const ValueKey('technician-m3')), findsNothing);

    await tester.enterText(
      find.descendant(of: search, matching: find.byType(TextField)),
      'zzz',
    );
    await tester.pumpAndSettle();
    expect(find.text('No technician matches your search.'), findsOneWidget);
  });

  testWidgets('shows Arabic wording and finds an Arabic name', (tester) async {
    await open(tester, _many, locale: const Locale('ar'));
    expect(find.text('تعيين فني'), findsOneWidget);
    final search = find.byKey(const ValueKey('technician-search'));
    await tester.enterText(
      find.descendant(of: search, matching: find.byType(TextField)),
      'احمد',
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('technician-ar')), findsOneWidget);
    expect(find.byKey(const ValueKey('technician-m1')), findsNothing);
  });
}

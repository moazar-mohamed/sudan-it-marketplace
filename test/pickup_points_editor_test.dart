import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/pickup_point.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/profile/pickup_points_editor.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Future<GlobalKey<PickupPointsEditorState>> _pump(
  WidgetTester tester, {
  List<PickupPoint> initial = const [],
}) async {
  final key = GlobalKey<PickupPointsEditorState>();
  final formKey = GlobalKey<FormState>();
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: Scaffold(
        body: SingleChildScrollView(
          child: Form(
            key: formKey,
            child: PickupPointsEditor(key: key, initial: initial),
          ),
        ),
      ),
    ),
  );
  return key;
}

void main() {
  testWidgets('starts on the company location with no points', (tester) async {
    final key = await _pump(tester);
    expect(key.currentState!.value, isEmpty);
    expect(find.byKey(const ValueKey('pickup-point-0')), findsNothing);
    expect(key.currentState!.validate(), isTrue);
  });

  testWidgets('custom mode adds up to five points and removes them', (tester) async {
    final key = await _pump(tester);
    await tester.tap(find.byKey(const ValueKey('pickup-mode-custom')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('pickup-point-0')), findsOneWidget);

    for (var i = 0; i < 4; i++) {
      await tester.ensureVisible(find.byKey(const ValueKey('pickup-point-add')));
      await tester.tap(find.byKey(const ValueKey('pickup-point-add')));
      await tester.pumpAndSettle();
    }
    expect(find.byKey(const ValueKey('pickup-point-4')), findsOneWidget);
    expect(find.byKey(const ValueKey('pickup-point-add')), findsNothing);
    expect(key.currentState!.value, hasLength(5));

    await tester.ensureVisible(
      find.byKey(const ValueKey('pickup-point-remove-4')),
    );
    await tester.tap(find.byKey(const ValueKey('pickup-point-remove-4')));
    await tester.pumpAndSettle();
    expect(key.currentState!.value, hasLength(4));
  });

  testWidgets('a point without an address or map point is refused', (tester) async {
    final key = await _pump(tester);
    await tester.tap(find.byKey(const ValueKey('pickup-mode-custom')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('pickup-point-name-0')),
      'Branch',
    );
    expect(key.currentState!.validate(), isFalse);
    await tester.pumpAndSettle();
    expect(
      find.text('Enter an address or select a point on the map.'),
      findsOneWidget,
    );

    await tester.enterText(find.byKey(const Key('location-text-field')), 'Street 9');
    expect(key.currentState!.validate(), isTrue);
    expect(key.currentState!.value.single.label, 'Branch — Street 9');
  });

  testWidgets('removing the last point goes back to the company location', (tester) async {
    final key = await _pump(
      tester,
      initial: const [PickupPoint(name: 'Branch', address: 'Street 9')],
    );
    expect(key.currentState!.value, hasLength(1));
    await tester.tap(find.byKey(const ValueKey('pickup-point-remove-0')));
    await tester.pumpAndSettle();
    expect(key.currentState!.value, isEmpty);
  });
}

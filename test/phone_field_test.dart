import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/widgets/app_widgets.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

void main() {
  late PhoneController controller;
  late GlobalKey<FormState> formKey;

  Future<void> pump(
    WidgetTester tester, {
    String? initial,
    String? requiredMessage = 'Please enter a contact phone number',
    Locale locale = const Locale('en'),
  }) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    controller = PhoneController(text: initial);
    addTearDown(controller.dispose);
    formKey = GlobalKey<FormState>();
    await tester.pumpWidget(
      MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: Form(
            key: formKey,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: PhoneField(
                label: 'Contact Phone Number',
                controller: controller,
                requiredMessage: requiredMessage,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Finder input() => find.byType(TextFormField);

  testWidgets('Sudan +249 is chosen from the start', (tester) async {
    await pump(tester);
    expect(find.text('+249'), findsOneWidget);
    expect(find.text('🇸🇩'), findsOneWidget);
    expect(controller.value, '');
  });

  testWidgets('a local number is saved with its country code', (tester) async {
    await pump(tester);
    await tester.enterText(input(), '0912 345 678');
    expect(controller.value, '+249912345678');
    expect(formKey.currentState!.validate(), isTrue);
  });

  testWidgets('a required empty number says so', (tester) async {
    await pump(tester);
    expect(formKey.currentState!.validate(), isFalse);
    await tester.pump();
    expect(find.text('Please enter a contact phone number'), findsOneWidget);
  });

  testWidgets('an optional empty number is fine', (tester) async {
    await pump(tester, requiredMessage: null);
    expect(formKey.currentState!.validate(), isTrue);
    expect(controller.value, '');
  });

  testWidgets('a Sudanese number must have 9 digits', (tester) async {
    await pump(tester);
    await tester.enterText(input(), '91234');
    expect(formKey.currentState!.validate(), isFalse);
    await tester.pump();
    expect(find.textContaining('Enter 9 digits after'), findsOneWidget);
  });

  testWidgets('a saved number opens with its own country', (tester) async {
    await pump(tester, initial: '+966501234567');
    expect(find.text('+966'), findsOneWidget);
    expect(controller.national.text, '501234567');
    expect(controller.value, '+966501234567');
  });

  testWidgets('a number saved without a code is read as Sudanese',
      (tester) async {
    await pump(tester, initial: '0912345678');
    expect(find.text('+249'), findsOneWidget);
    expect(controller.value, '+249912345678');
  });

  testWidgets('pasting a whole number picks its country', (tester) async {
    await pump(tester);
    await tester.enterText(input(), '+971 50 123 4567');
    await tester.pump();
    expect(find.text('+971'), findsOneWidget);
    expect(controller.national.text, '501234567');
    expect(controller.value, '+971501234567');
  });

  testWidgets('the country is chosen from a searchable list', (tester) async {
    await pump(tester);
    await tester.enterText(input(), '501234567');
    await tester.tap(find.byKey(const ValueKey('phone-country-code')));
    await tester.pumpAndSettle();

    expect(find.text('Choose the country code'), findsOneWidget);
    expect(find.text('Most used'), findsOneWidget);

    await tester.enterText(
      find.descendant(
        of: find.byKey(const ValueKey('phone-country-search')),
        matching: find.byType(TextField),
      ),
      'saudi',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('phone-country-SA')));
    await tester.pumpAndSettle();

    expect(find.text('Choose the country code'), findsNothing);
    expect(find.text('+966'), findsOneWidget);
    expect(controller.value, '+966501234567');
  });

  testWidgets('choosing another country rechecks a shown error',
      (tester) async {
    await pump(tester);
    await tester.enterText(input(), '44123456');
    expect(formKey.currentState!.validate(), isFalse);
    await tester.pump();
    expect(find.textContaining('Enter 9 digits after'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('phone-country-code')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.descendant(
        of: find.byKey(const ValueKey('phone-country-search')),
        matching: find.byType(TextField),
      ),
      'qatar',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('phone-country-QA')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Enter 9 digits after'), findsNothing);
    expect(controller.value, '+97444123456');
  });

  testWidgets('no match says so', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('phone-country-code')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.descendant(
        of: find.byKey(const ValueKey('phone-country-search')),
        matching: find.byType(TextField),
      ),
      'zzzz',
    );
    await tester.pumpAndSettle();
    expect(find.text('No country matches your search.'), findsOneWidget);
  });

  testWidgets('in Arabic the number still reads left to right',
      (tester) async {
    await pump(tester, locale: const Locale('ar'));
    await tester.enterText(input(), '912345678');
    await tester.pump();

    // The code sits on the left of the typed number, as in "+249 912345678".
    final code = tester.getCenter(find.text('+249'));
    final number = tester.getCenter(find.text('912345678'));
    expect(code.dx, lessThan(number.dx));

    // The label keeps the screen's direction.
    expect(
      tester.getTopRight(find.text('Contact Phone Number')).dx,
      greaterThan(tester.getCenter(input()).dx),
    );

    expect(
      find.bySemanticsLabel(RegExp('مفتاح الدولة: السودان')),
      findsOneWidget,
    );
  });
}

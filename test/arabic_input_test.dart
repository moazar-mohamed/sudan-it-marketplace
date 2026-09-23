import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/technicians/technician_form_screen.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// The app does not restrict what letters a form accepts: Arabic can be typed
/// exactly like English. (Typing Arabic on an Android emulator also needs an
/// Arabic keyboard layout enabled in the emulator's keyboard settings.)
void main() {
  testWidgets('the Add Technician form accepts Arabic text', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: [Locale('en'), Locale('ar')],
          locale: Locale('ar'),
          home: TechnicianFormScreen.add(companyId: 'c1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'أحمد محمد عثمان');
    await tester.pump();

    expect(find.text('أحمد محمد عثمان'), findsOneWidget);
  });
}

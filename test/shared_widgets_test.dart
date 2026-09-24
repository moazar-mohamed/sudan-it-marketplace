import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_colors.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/core/widgets/app_widgets.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';

Widget _app(Widget child, {Locale locale = const Locale('en')}) => MaterialApp(
  theme: AppTheme.light,
  locale: locale,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  group('AppButton', () {
    testWidgets('calls onPressed and shows its label', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        _app(AppButton(label: 'Save', onPressed: () => taps++)),
      );
      await tester.tap(find.text('Save'));
      expect(taps, 1);
    });

    testWidgets('a loading button shows a spinner and ignores taps', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        _app(AppButton(label: 'Save', loading: true, onPressed: () => taps++)),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      // The label stays so the button does not change width.
      expect(find.text('Save'), findsOneWidget);
      await tester.tap(find.text('Save'), warnIfMissed: false);
      expect(taps, 0);
    });

    testWidgets('a null onPressed disables the button', (tester) async {
      await tester.pumpWidget(
        _app(const AppButton(label: 'Save', onPressed: null)),
      );
      final button = tester.widget<FilledButton>(find.byType(FilledButton));
      expect(button.onPressed, isNull);
    });

    testWidgets('sizes follow the design: large 48, medium 40, small 32', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          Column(
            children: [
              AppButton(label: 'L', onPressed: () {}),
              AppButton(
                label: 'M',
                size: AppButtonSize.medium,
                onPressed: () {},
              ),
              AppButton(
                label: 'S',
                size: AppButtonSize.small,
                onPressed: () {},
              ),
            ],
          ),
        ),
      );
      // The visible surface (the ink well); the 48 px touch target around a
      // smaller button is added by Material and is intentionally kept.
      double h(String label) => tester
          .getSize(
            find.descendant(
              of: find.ancestor(
                of: find.text(label),
                matching: find.byType(FilledButton),
              ),
              matching: find.byType(InkWell),
            ),
          )
          .height;
      expect(h('L'), 48);
      expect(h('M'), 40);
      expect(h('S'), 32);
    });

    testWidgets('each emphasis renders the right button family', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          Column(
            children: [
              AppButton.outlined(label: 'A', onPressed: () {}),
              AppButton.text(label: 'B', onPressed: () {}),
              AppButton.destructiveOutlined(label: 'C', onPressed: () {}),
              AppButton.destructive(label: 'D', onPressed: () {}),
              AppButton.secondary(label: 'E', onPressed: () {}),
            ],
          ),
        ),
      );
      expect(find.byType(OutlinedButton), findsNWidgets(2));
      expect(find.byType(TextButton), findsOneWidget);
      expect(find.byType(FilledButton), findsNWidgets(2));
    });

    testWidgets('the icon comes first in reading order in RTL', (tester) async {
      await tester.pumpWidget(
        _app(
          AppButton(label: 'Send', icon: Icons.send, onPressed: () {}),
          locale: const Locale('ar'),
        ),
      );
      final icon = tester.getCenter(find.byIcon(Icons.send)).dx;
      final text = tester.getCenter(find.text('Send')).dx;
      // RTL: the start (icon) is on the right.
      expect(icon, greaterThan(text));
    });
  });

  group('AppTextField', () {
    testWidgets('the label sits above the field and stays visible', (
      tester,
    ) async {
      final controller = TextEditingController(text: 'abc');
      await tester.pumpWidget(
        _app(AppTextField(label: 'Email', controller: controller)),
      );
      final label = tester.getTopLeft(find.text('Email')).dy;
      final field = tester.getTopLeft(find.byType(TextField)).dy;
      expect(label, lessThan(field));
      expect(find.text('abc'), findsOneWidget);
    });

    testWidgets('a validation error shows icon and text', (tester) async {
      final key = GlobalKey<FormState>();
      await tester.pumpWidget(
        _app(
          Form(
            key: key,
            child: AppTextField(
              label: 'Name',
              validator: (v) => (v ?? '').isEmpty ? 'Name is required.' : null,
            ),
          ),
        ),
      );
      expect(key.currentState!.validate(), isFalse);
      await tester.pump();
      expect(find.text('Name is required.'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
    });

    testWidgets('a password field can be revealed and hidden again', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(const AppTextField(label: 'Password', password: true)),
      );
      bool obscured() =>
          tester.widget<EditableText>(find.byType(EditableText)).obscureText;
      expect(obscured(), isTrue);
      await tester.tap(find.byIcon(Icons.visibility_outlined));
      await tester.pump();
      expect(obscured(), isFalse);
      await tester.tap(find.byIcon(Icons.visibility_off_outlined));
      await tester.pump();
      expect(obscured(), isTrue);
    });

    testWidgets('helper text shows when there is no error', (tester) async {
      await tester.pumpWidget(
        _app(const AppTextField(label: 'Pw', helperText: 'At least 6.')),
      );
      expect(find.text('At least 6.'), findsOneWidget);
    });

    group('read-only (disabled) fields stay readable', () {
      double contrast(Color a, Color b) {
        final l1 = a.computeLuminance();
        final l2 = b.computeLuminance();
        return (l1 > l2 ? l1 + 0.05 : l2 + 0.05) /
            (l1 > l2 ? l2 + 0.05 : l1 + 0.05);
      }

      Color labelColor(WidgetTester tester, String label) {
        final text = tester.widget<Text>(
          find.byWidgetPredicate(
            (w) => w is Text && (w.textSpan?.toPlainText() ?? '') == label,
          ),
        );
        return text.style!.color!;
      }

      Color valueColor(WidgetTester tester) =>
          tester.widget<EditableText>(find.byType(EditableText)).style.color!;

      Color fill(WidgetTester tester) => tester
          .widget<InputDecorator>(find.byType(InputDecorator))
          .decoration
          .fillColor!;

      for (final (name, locale, label, value) in [
        ('English', const Locale('en'), 'Email', 'moazer@example.test'),
        (
          'Arabic (RTL)',
          const Locale('ar'),
          'البريد الإلكتروني',
          'moazer@example.test',
        ),
      ]) {
        testWidgets('label and value pass AA contrast - $name', (tester) async {
          await tester.pumpWidget(
            _app(
              AppTextField(
                label: label,
                initialValue: value,
                enabled: false,
                textDirection: TextDirection.ltr,
              ),
              locale: locale,
            ),
          );
          final page = AppColors.background;
          expect(
            contrast(labelColor(tester, label), page),
            greaterThanOrEqualTo(4.5),
            reason: 'the label above a read-only field is too pale',
          );
          expect(
            contrast(valueColor(tester), fill(tester)),
            greaterThanOrEqualTo(4.5),
            reason: 'the read-only value is too pale',
          );
        });
      }

      testWidgets(
        'a read-only field still looks different from an editable one',
        (tester) async {
          await tester.pumpWidget(
            _app(
              const Column(
                children: [
                  AppTextField(label: 'Name', initialValue: 'A'),
                  AppTextField(
                    label: 'Email',
                    initialValue: 'B',
                    enabled: false,
                  ),
                ],
              ),
            ),
          );
          final decorators = tester
              .widgetList<InputDecorator>(find.byType(InputDecorator))
              .toList();
          // muted fill instead of white, and a lighter border
          expect(decorators[0].decoration.fillColor, AppColors.surface);
          expect(decorators[1].decoration.fillColor, AppColors.bgSubtle);
          expect(labelColor(tester, 'Name'), AppColors.textPrimary);
          expect(labelColor(tester, 'Email'), AppColors.textSecondary);
          expect(
            tester
                .widgetList<EditableText>(find.byType(EditableText))
                .map((e) => e.readOnly),
            [false, true],
          );
        },
      );

      testWidgets('a disabled dropdown label uses the same readable colour', (
        tester,
      ) async {
        await tester.pumpWidget(
          _app(
            AppDropdownField<int>(
              label: 'City',
              enabled: false,
              onChanged: null,
              items: const [DropdownMenuItem(value: 1, child: Text('One'))],
            ),
          ),
        );
        expect(
          contrast(labelColor(tester, 'City'), AppColors.background),
          greaterThanOrEqualTo(4.5),
        );
      });
    });

    testWidgets('the search field clears itself', (tester) async {
      String? last;
      await tester.pumpWidget(
        _app(AppSearchField(hint: 'Search…', onChanged: (v) => last = v)),
      );
      expect(find.byIcon(Icons.close), findsNothing);
      await tester.enterText(find.byType(TextField), 'router');
      await tester.pump();
      expect(find.byIcon(Icons.close), findsOneWidget);
      await tester.tap(find.byIcon(Icons.close));
      await tester.pump();
      expect(last, '');
      expect(find.byIcon(Icons.close), findsNothing);
    });
  });

  group('status, states and feedback', () {
    testWidgets('a status chip shows its label with a dot', (tester) async {
      await tester.pumpWidget(
        _app(const StatusChip(label: 'Pending', tone: AppTone.warning)),
      );
      expect(find.text('Pending'), findsOneWidget);
      final decorated = tester
          .widgetList<Container>(find.byType(Container))
          .map((c) => c.decoration)
          .whereType<BoxDecoration>();
      expect(
        decorated.any((d) => d.color == AppTone.warning.background),
        isTrue,
      );
      expect(decorated.any((d) => d.color == AppTone.warning.accent), isTrue);
    });

    testWidgets('the error state offers a localized retry', (tester) async {
      var retried = false;
      await tester.pumpWidget(
        _app(
          SizedBox(
            height: 400,
            child: AppErrorState(
              message: 'Could not load.',
              onRetry: () => retried = true,
            ),
          ),
        ),
      );
      expect(find.text('Could not load.'), findsOneWidget);
      await tester.tap(find.text('Try again'));
      expect(retried, isTrue);
    });

    testWidgets('the empty state shows message and action', (tester) async {
      await tester.pumpWidget(
        _app(
          AppEmptyState(
            icon: Icons.inbox_outlined,
            title: 'No orders',
            message: 'They appear here.',
            action: AppButton.outlined(label: 'Browse', onPressed: () {}),
          ),
        ),
      );
      expect(find.text('No orders'), findsOneWidget);
      expect(find.text('They appear here.'), findsOneWidget);
      expect(find.text('Browse'), findsOneWidget);
    });

    testWidgets('skeleton rows and the spinner render', (tester) async {
      await tester.pumpWidget(
        _app(const Column(children: [AppSkeletonList(count: 2)])),
      );
      expect(find.byType(AppSkeletonList), findsOneWidget);
      await tester.pumpWidget(
        _app(
          const SizedBox(
            height: 200,
            child: AppLoadingState(label: 'Loading…'),
          ),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Loading…'), findsOneWidget);
    });

    testWidgets('the confirmation dialog resolves true only on confirm', (
      tester,
    ) async {
      bool? result;
      await tester.pumpWidget(
        _app(
          Builder(
            builder: (context) => TextButton(
              onPressed: () async => result = await showConfirmationDialog(
                context,
                title: 'Cancel this request?',
                body: 'This cannot be undone.',
                confirmLabel: 'Cancel request',
                destructive: true,
              ),
              child: const Text('open'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Cancel this request?'), findsOneWidget);
      await tester.tap(find.text('Cancel')); // the safe choice
      await tester.pumpAndSettle();
      expect(result, isFalse);

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel request'));
      await tester.pumpAndSettle();
      expect(result, isTrue);
    });

    testWidgets('a banner shows icon, title and message', (tester) async {
      await tester.pumpWidget(
        _app(
          const AppBanner(
            tone: AppTone.warning,
            title: 'Low stock',
            message: 'Only 3 left.',
          ),
        ),
      );
      expect(find.text('Low stock'), findsOneWidget);
      expect(find.text('Only 3 left.'), findsOneWidget);
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    });

    testWidgets('a snackbar carries an icon for errors', (tester) async {
      await tester.pumpWidget(
        _app(
          Builder(
            builder: (context) => TextButton(
              onPressed: () =>
                  showAppSnackBar(context, 'Failed.', tone: AppTone.error),
              child: const Text('go'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('go'));
      await tester.pump();
      expect(find.text('Failed.'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
    });
  });

  group('surfaces and navigation', () {
    testWidgets('section card, key-value rows and header render', (
      tester,
    ) async {
      var viewed = false;
      await tester.pumpWidget(
        _app(
          Column(
            children: [
              SectionHeader(
                title: 'Recent orders',
                actionLabel: 'View all',
                onAction: () => viewed = true,
              ),
              const SectionCard(
                title: 'Order',
                trailing: StatusChip(label: 'Done', tone: AppTone.success),
                children: [
                  KeyValueRow(
                    label: 'Total',
                    value: '405,000 SDG',
                    emphasize: true,
                  ),
                ],
              ),
            ],
          ),
        ),
      );
      expect(find.text('Order'), findsOneWidget);
      expect(find.text('405,000 SDG'), findsOneWidget);
      final value = tester.widget<Text>(find.text('405,000 SDG'));
      expect(value.style?.color, AppColors.textBrand);
      await tester.tap(find.text('View all'));
      expect(viewed, isTrue);
    });

    testWidgets('tabs report the tapped index and mirror in RTL', (
      tester,
    ) async {
      int? picked;
      await tester.pumpWidget(
        _app(
          AppUnderlineTabs(
            labels: const ['Products', 'Services'],
            selectedIndex: 0,
            onChanged: (i) => picked = i,
          ),
          locale: const Locale('ar'),
        ),
      );
      // In RTL the first tab is on the right.
      expect(
        tester.getCenter(find.text('Products')).dx,
        greaterThan(tester.getCenter(find.text('Services')).dx),
      );
      await tester.tap(find.text('Services'));
      expect(picked, 1);
    });

    testWidgets('filter chips select one at a time', (tester) async {
      int? picked;
      await tester.pumpWidget(
        _app(
          AppFilterChips(
            labels: const ['All (3)', 'Pending (1)'],
            selectedIndex: 0,
            onChanged: (i) => picked = i,
          ),
        ),
      );
      await tester.tap(find.text('Pending (1)'));
      expect(picked, 1);
    });

    testWidgets('the avatar falls back to the first letter', (tester) async {
      await tester.pumpWidget(_app(const AppAvatar(name: 'Al-Amal')));
      expect(find.text('A'), findsOneWidget);
    });
  });

  group('shared primitives that replaced per-screen copies', () {
    testWidgets('tabbed view follows taps and builds a page only when shown', (
      tester,
    ) async {
      var secondBuilt = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: AppTabbedView(
              labels: const ['Products', 'Services'],
              children: [
                const Text('first page'),
                Builder(
                  builder: (_) {
                    secondBuilt++;
                    return const Text('second page');
                  },
                ),
              ],
            ),
          ),
        ),
      );
      expect(find.text('first page'), findsOneWidget);
      expect(secondBuilt, 0);

      await tester.tap(find.text('Services'));
      await tester.pumpAndSettle();
      expect(find.text('second page'), findsOneWidget);
      expect(find.text('first page'), findsNothing);
      expect(secondBuilt, greaterThan(0));
    });

    testWidgets('tabbed view follows a swipe', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(
            body: AppTabbedView(
              labels: ['One', 'Two'],
              children: [Text('page one'), Text('page two')],
            ),
          ),
        ),
      );
      await tester.fling(find.text('page one'), const Offset(-400, 0), 1500);
      await tester.pumpAndSettle();
      expect(find.text('page two'), findsOneWidget);
    });

    testWidgets('an image without a URL shows the fallback', (tester) async {
      await tester.pumpWidget(
        _app(const AppNetworkImage(url: '', fallback: Text('fallback'))),
      );
      expect(find.text('fallback'), findsOneWidget);
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('bottom bar shows its child on a bordered surface', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            bottomNavigationBar: AppBottomBar(child: Text('Buy now')),
          ),
        ),
      );
      expect(find.text('Buy now'), findsOneWidget);
      final decoration =
          tester
                  .widget<Container>(
                    find.ancestor(
                      of: find.byType(SafeArea),
                      matching: find.byType(Container),
                    ),
                  )
                  .decoration!
              as BoxDecoration;
      expect(decoration.color, AppColors.surface);
      expect(decoration.border, isNotNull);
    });

    testWidgets('unread dot is a small brand-coloured circle', (tester) async {
      await tester.pumpWidget(_app(const Center(child: AppUnreadDot())));
      final box = tester.getSize(find.byType(AppUnreadDot));
      expect(box, const Size(10, 10));
    });

    testWidgets('spinner uses the requested size', (tester) async {
      await tester.pumpWidget(_app(const Center(child: AppSpinner(size: 20))));
      expect(tester.getSize(find.byType(AppSpinner)), const Size(20, 20));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('right-to-left details', () {
    testWidgets(
      'a left-to-right value lines up with the other values in Arabic',
      (tester) async {
        await tester.pumpWidget(
          _app(
            const Column(
              children: [
                KeyValueRow(label: 'الاسم', value: 'Amira'),
                KeyValueRow(
                  label: 'الهاتف',
                  value: '0912345678',
                  valueTextDirection: TextDirection.ltr,
                ),
              ],
            ),
            locale: const Locale('ar'),
          ),
        );
        // In RTL the end of the row is its left edge: both values must touch it.
        final name = tester.getTopLeft(find.text('Amira')).dx;
        final phone = tester.getTopLeft(find.text('0912345678')).dx;
        expect(phone, closeTo(name, 1.0));
      },
    );

    test('Arabic order and job titles keep the # next to the code', () {
      final ar = AppLocalizationsAr();
      expect(ar.orderTitleNumber('ab12'), contains('‎#ab12'));
      expect(ar.adminJobTitleNumber('ab12'), contains('‎#ab12'));
    });

    testWidgets('option cards in a row have the same height', (tester) async {
      await tester.pumpWidget(
        _app(
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: AppOptionCard(
                    title: 'Short',
                    subtitle: '0 SDG',
                    selected: true,
                    onTap: () {},
                  ),
                ),
                Expanded(
                  child: AppOptionCard(
                    title: 'A much longer title that wraps onto lines',
                    subtitle: '+15,000 SDG',
                    selected: false,
                    onTap: () {},
                  ),
                ),
              ],
            ),
          ),
        ),
      );
      final first = tester.getSize(find.byType(AppOptionCard).first).height;
      final second = tester.getSize(find.byType(AppOptionCard).last).height;
      expect(first, second);
    });
  });
}

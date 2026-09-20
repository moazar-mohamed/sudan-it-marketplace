import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_locale.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/language_sync.dart';

/// Changes the app language and reports a failed profile save. Shared by the
/// login selector and the Settings screen.
Future<void> changeAppLanguage(
  BuildContext context,
  WidgetRef ref,
  Locale locale,
) async {
  if (ref.read(localeControllerProvider) == locale) return;
  final saved = await ref.read(languageServiceProvider).change(locale);
  if (saved || !context.mounted) return;
  // Said in the language just chosen: the screen may not have been rebuilt in
  // it yet, and it is the language the user is now reading.
  final message = lookupAppLocalizations(locale).settingsLanguageSyncFailed;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Language names are always shown in their own language, so a user can find
/// theirs whichever language the app is currently in.
String languageName(BuildContext context, Locale locale) {
  return locale.languageCode == 'ar'
      ? context.l10n.languageArabic
      : context.l10n.languageEnglish;
}

/// Compact "English | العربية" switch for the authentication screens.
class LanguageSelector extends ConsumerWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeControllerProvider);
    return SegmentedButton<String>(
      showSelectedIcon: false,
      segments: [
        for (final locale in AppLocale.supported)
          ButtonSegment<String>(
            value: locale.languageCode,
            label: Text(languageName(context, locale)),
          ),
      ],
      selected: {current.languageCode},
      onSelectionChanged: (selection) {
        final locale = AppLocale.tryParse(selection.first);
        if (locale != null) changeAppLanguage(context, ref, locale);
      },
    );
  }
}

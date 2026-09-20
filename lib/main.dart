import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/localization/form_revalidation.dart';
import 'core/localization/l10n_extension.dart';
import 'core/localization/locale_controller.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/auth_gate.dart';
import 'features/auth/presentation/language_sync.dart';
import 'firebase_options.dart';
import 'l10n/app_localizations.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // The language chosen on this device. If storage is unavailable the app
  // still runs (in English) and simply does not remember the choice.
  SharedPreferences? preferences;
  try {
    preferences = await SharedPreferences.getInstance();
  } catch (_) {
    preferences = null;
  }

  runApp(
    ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(preferences)],
      child: const SudanITMarketplaceApp(),
    ),
  );
}

class SudanITMarketplaceApp extends ConsumerWidget {
  const SudanITMarketplaceApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Changing this rebuilds the whole app in the new language, and Flutter
    // flips the layout direction (RTL for Arabic) from the locale itself.
    final locale = ref.watch(localeControllerProvider);
    // Keeps the language and the signed-in user's profile in step.
    ref.watch(languageSyncProvider);

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (context) => context.l10n.appName,
      theme: AppTheme.light,
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) =>
          FormLocaleRefresher(child: child ?? const SizedBox.shrink()),
      home: const AuthGate(),
    );
  }
}

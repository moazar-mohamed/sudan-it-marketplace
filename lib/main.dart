import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/localization/form_revalidation.dart';
import 'core/localization/l10n_extension.dart';
import 'core/localization/locale_controller.dart';
import 'core/navigation/app_keys.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'features/auth/presentation/auth_gate.dart';
import 'features/auth/presentation/language_sync.dart';
import 'features/platform_notices/presentation/platform_notice_gate.dart';
import 'features/push/presentation/push_setup.dart';
import 'features/usage/presentation/usage_providers.dart';
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
    final themeMode = ref.watch(themeModeControllerProvider);
    // Keeps the language and the signed-in user's profile in step.
    ref.watch(languageSyncProvider);
    // Phone push notifications (off until the push relay is configured).
    ref.watch(pushSetupProvider);
    // Tells the platform the app was opened today (once a day, nothing personal).
    ref.watch(usageSyncProvider);

    return MaterialApp(
      navigatorKey: appNavigatorKey,
      scaffoldMessengerKey: appScaffoldMessengerKey,
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (context) => context.l10n.appName,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => FormLocaleRefresher(
        child: PlatformNoticeGate(child: child ?? const SizedBox.shrink()),
      ),
      home: const AuthGate(),
    );
  }
}

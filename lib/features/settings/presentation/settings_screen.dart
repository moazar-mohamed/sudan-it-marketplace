import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_locale.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../../core/localization/locale_controller.dart';
import 'language_selector.dart';

/// App settings, reachable from every signed-in area. Currently the language.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final current = ref.watch(localeControllerProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          ListTile(
            leading: Icon(Icons.language, color: theme.colorScheme.primary),
            title: Text(
              l10n.commonLanguage,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            subtitle: Text(l10n.settingsLanguageSubtitle),
          ),
          RadioGroup<String>(
            groupValue: current.languageCode,
            onChanged: (code) {
              final locale = AppLocale.tryParse(code);
              if (locale != null) changeAppLanguage(context, ref, locale);
            },
            child: Column(
              children: [
                for (final locale in AppLocale.supported)
                  RadioListTile<String>(
                    value: locale.languageCode,
                    title: Text(languageName(context, locale)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The gear button that opens [SettingsScreen], for the AppBars.
class SettingsButton extends StatelessWidget {
  const SettingsButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: context.l10n.settingsTitle,
      icon: const Icon(Icons.settings_outlined),
      onPressed: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
        );
      },
    );
  }
}

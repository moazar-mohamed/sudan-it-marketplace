import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_locale.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import 'language_selector.dart';

/// App settings, reachable from every signed-in area. Currently the language.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final current = ref.watch(localeControllerProvider);
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: ListView(
        padding: EdgeInsets.all(margin),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
              child: SectionCard(
                title: l10n.commonLanguage,
                gap: AppSpacing.s4,
                children: [
                  Text(
                    l10n.settingsLanguageSubtitle,
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: AppSpacing.s8),
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
                            contentPadding: EdgeInsets.zero,
                            value: locale.languageCode,
                            title: Text(languageName(context, locale)),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
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

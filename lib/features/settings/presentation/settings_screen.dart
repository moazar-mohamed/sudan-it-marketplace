import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_locale.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/push/push_relay.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../push/presentation/push_preference.dart';
import '../../reports/presentation/my_reports_screen.dart';
import '../../reports/presentation/report_form_screen.dart';
import 'language_selector.dart';
import 'settings_option_sheet.dart';

/// App settings, reachable from every signed-in area: a grouped list of rows,
/// each showing its current value and opening a picker sheet.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final locale = ref.watch(localeControllerProvider);
    final mode = ref.watch(themeModeControllerProvider);
    // The switch only exists where pushes can be sent at all (not on the web,
    // and not in a build with no push relay).
    final pushAvailable = !kIsWeb && ref.watch(pushRelayProvider).isEnabled;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: AppCenteredList(
        children: [
          _GroupLabel(l10n.settingsPreferences),
          _SettingsGroup(
            children: [
              _SettingsRow(
                key: const ValueKey('settings-language'),
                icon: Icons.translate_rounded,
                title: l10n.commonLanguage,
                value: languageName(context, locale),
                onTap: () => _pickLanguage(context, ref, locale),
              ),
              _SettingsRow(
                key: const ValueKey('settings-appearance'),
                icon: _themeIcon(mode),
                title: l10n.settingsAppearance,
                value: _themeLabel(context, mode),
                onTap: () => _pickTheme(context, ref, mode),
              ),
            ],
          ),
          if (pushAvailable) ...[
            const SizedBox(height: AppSpacing.s20),
            _GroupLabel(l10n.settingsNotifications),
            _SettingsGroup(
              children: [
                _PushSwitchRow(
                  enabled: ref.watch(pushEnabledProvider),
                  blocked: ref.watch(pushBlockedProvider),
                  onChanged: (value) => ref
                      .read(pushEnabledProvider.notifier)
                      .setEnabled(value),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.s20),
          _GroupLabel(l10n.settingsHelp),
          _SettingsGroup(
            children: [
              _SettingsRow(
                key: const ValueKey('settings-report'),
                icon: Icons.flag_outlined,
                title: l10n.reportFormTitle,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<bool>(
                    builder: (_) => const ReportFormScreen(),
                  ),
                ),
              ),
              _SettingsRow(
                key: const ValueKey('settings-my-reports'),
                icon: Icons.inbox_outlined,
                title: l10n.myReportsTitle,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const MyReportsScreen(),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _pickLanguage(
    BuildContext context,
    WidgetRef ref,
    Locale current,
  ) async {
    final picked = await showSettingsOptionSheet<String>(
      context,
      title: context.l10n.commonLanguage,
      subtitle: context.l10n.settingsLanguageSubtitle,
      selected: current.languageCode,
      options: [
        for (final locale in AppLocale.supported)
          SettingsOption(
            value: locale.languageCode,
            label: languageName(context, locale),
            leading: _LanguageBadge(locale.languageCode),
          ),
      ],
    );
    final locale = AppLocale.tryParse(picked);
    if (locale == null || !context.mounted) return;
    await changeAppLanguage(context, ref, locale);
  }

  Future<void> _pickTheme(
    BuildContext context,
    WidgetRef ref,
    ThemeMode current,
  ) async {
    final l10n = context.l10n;
    final picked = await showSettingsOptionSheet<ThemeMode>(
      context,
      title: l10n.settingsAppearance,
      subtitle: l10n.settingsAppearanceSubtitle,
      selected: current,
      options: [
        for (final mode in const [
          ThemeMode.system,
          ThemeMode.light,
          ThemeMode.dark,
        ])
          SettingsOption(
            value: mode,
            label: _themeLabel(context, mode),
            subtitle: mode == ThemeMode.system ? l10n.themeSystemHint : null,
            leading: _ThemeSwatch(mode),
          ),
      ],
    );
    if (picked == null) return;
    await ref.read(themeModeControllerProvider.notifier).setMode(picked);
  }
}

String _themeLabel(BuildContext context, ThemeMode mode) => switch (mode) {
      ThemeMode.system => context.l10n.themeSystem,
      ThemeMode.light => context.l10n.themeLight,
      ThemeMode.dark => context.l10n.themeDark,
    };

IconData _themeIcon(ThemeMode mode) => switch (mode) {
      ThemeMode.system => Icons.brightness_auto_outlined,
      ThemeMode.light => Icons.light_mode_outlined,
      ThemeMode.dark => Icons.dark_mode_outlined,
    };

/// Small uppercase heading above a group of rows.
class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(
        start: AppSpacing.s4,
        bottom: AppSpacing.s8,
      ),
      child: Text(
        text.toUpperCase(),
        style: AppTextStyles.captionStrong.copyWith(
          color: context.colors.textSecondary,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

/// Rows stacked on one bordered card, separated by inset dividers.
class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.mdAll,
        side: BorderSide(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
              Divider(
                height: 1,
                indent: AppSpacing.s16 + 40 + AppSpacing.s12,
                color: colors.borderDefault,
              ),
            children[i],
          ],
        ],
      ),
    );
  }
}

/// Icon, title, the current value and a chevron; the whole row is the target.
class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    super.key,
    required this.icon,
    required this.title,
    this.value = '',
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      label: value.isEmpty ? title : '$title, $value',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s16,
              vertical: AppSpacing.s12,
            ),
            child: Row(
              children: [
                AppIconTile(icon: icon, size: 40, iconSize: AppSize.iconMd),
                const SizedBox(width: AppSpacing.s12),
                Expanded(child: Text(title, style: AppTextStyles.bodyStrong)),
                const SizedBox(width: AppSpacing.s8),
                if (value.isNotEmpty)
                  ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 160),
                  child: Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.body.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.s4),
                Icon(Icons.chevron_right_rounded, color: colors.iconMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The switch for this phone's notifications: its subtitle says whether it is
/// on, off, or on but blocked by the phone's own settings.
class _PushSwitchRow extends StatelessWidget {
  const _PushSwitchRow({
    required this.enabled,
    required this.blocked,
    required this.onChanged,
  });

  final bool enabled;
  final bool blocked;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final blockedNow = enabled && blocked;
    final subtitle = blockedNow
        ? l10n.settingsPushBlocked
        : enabled
            ? l10n.settingsPushOn
            : l10n.settingsPushOff;
    return Semantics(
      container: true,
      child: InkWell(
        key: const ValueKey('settings-push'),
        onTap: () => onChanged(!enabled),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s16,
              vertical: AppSpacing.s12,
            ),
            child: Row(
              children: [
                AppIconTile(
                  icon: enabled
                      ? Icons.notifications_active_outlined
                      : Icons.notifications_off_outlined,
                  size: 40,
                  iconSize: AppSize.iconMd,
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.settingsPushTitle,
                          style: AppTextStyles.bodyStrong),
                      Text(
                        subtitle,
                        style: AppTextStyles.body.copyWith(
                          color: blockedNow
                              ? colors.error
                              : colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.s8),
                Switch(value: enabled, onChanged: onChanged),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "EN" / "ع" disc leading each language, written in that language.
class _LanguageBadge extends StatelessWidget {
  const _LanguageBadge(this.code);

  final String code;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.bgSubtle,
        shape: BoxShape.circle,
        border: Border.all(color: colors.borderDefault),
      ),
      child: Text(
        code == 'ar' ? 'ع' : code.toUpperCase(),
        style: AppTextStyles.labelLarge.copyWith(
          color: colors.textBrand,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// A miniature screen in the palette the option stands for; "system" shows
/// the light and dark halves side by side.
class _ThemeSwatch extends StatelessWidget {
  const _ThemeSwatch(this.mode);

  final ThemeMode mode;

  @override
  Widget build(BuildContext context) {
    final palettes = switch (mode) {
      ThemeMode.light => const [AppColorTokens.light],
      ThemeMode.dark => const [AppColorTokens.dark],
      ThemeMode.system => const [AppColorTokens.light, AppColorTokens.dark],
    };
    return Container(
      width: 40,
      height: 40,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: AppRadius.smAll,
        border: Border.all(color: context.colors.borderStrong),
      ),
      child: Row(
        children: [
          for (final palette in palettes)
            Expanded(child: _MiniScreen(palette)),
        ],
      ),
    );
  }
}

class _MiniScreen extends StatelessWidget {
  const _MiniScreen(this.palette);

  final AppColorTokens palette;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: palette.bgApp,
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 6,
              decoration: BoxDecoration(
                color: palette.primary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 3),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: palette.surface,
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: palette.borderDefault, width: 0.5),
                ),
              ),
            ),
          ],
        ),
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

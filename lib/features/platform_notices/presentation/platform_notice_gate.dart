import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/domain/entities/user_role.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../domain/platform_notices.dart';
import 'platform_notices_providers.dart';

/// Wraps the whole app with the Platform Admin's notices: an "update
/// required" screen for an app that is too old, a maintenance message that
/// covers the app while it is on, and an announcement banner above it for the
/// people it is meant for.
///
/// A notice with a schedule shows and hides itself at its start and end time.
/// The app underneath stays mounted either way (the same widgets in the same
/// places), so a notice coming and going never restarts what the user was doing.
class PlatformNoticeGate extends ConsumerWidget {
  const PlatformNoticeGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notices =
        ref.watch(platformNoticesProvider).value ?? PlatformNotices.none;
    final role = ref.watch(profileControllerProvider).value?.role;
    final dismissed = ref.watch(dismissedAnnouncementProvider);
    final language = Localizations.localeOf(context).languageCode;

    // A clock only runs while some notice has a start or an end to wait for.
    final now = notices.hasSchedule
        ? (ref.watch(noticeClockProvider).value ?? DateTime.now())
        : DateTime.now();

    // Platform Admins use the web dashboard, and must never be locked out of
    // turning maintenance off or lowering the required build.
    final isAdmin = role == UserRole.platformAdmin;
    final maintenanceText =
        isAdmin ? null : notices.maintenance.textFor(language, now: now);
    final announcement = notices.announcement.textFor(language, now: now);
    final showBanner = announcement != null &&
        notices.announcementIsFor(role) &&
        dismissed != notices.announcementKey;
    final updateRequired = !isAdmin &&
        notices.update.isRequiredFor(ref.watch(appBuildNumberProvider).value);

    return Stack(
      children: [
        Column(
          children: [
            if (showBanner)
              _AnnouncementBanner(
                message: announcement,
                kind: notices.announcementKind,
                link: notices.announcement.link,
                onDismiss: () => ref
                    .read(dismissedAnnouncementProvider.notifier)
                    .dismiss(notices.announcementKey),
              )
            else
              const SizedBox.shrink(),
            Expanded(
              // The banner sits under the status bar, so what is below it
              // must not add the status bar's height a second time.
              child: MediaQuery.removePadding(
                context: context,
                removeTop: showBanner,
                child: child,
              ),
            ),
          ],
        ),
        if (maintenanceText != null)
          Positioned.fill(
            key: const ValueKey('maintenance'),
            child: _MaintenanceScreen(
              message: maintenanceText,
              endsAt: notices.maintenance.endsAt,
              now: now,
              link: notices.maintenance.link,
            ),
          ),
        // Last, so it is above maintenance: an app that is too old cannot be
        // used whatever else is on.
        if (updateRequired)
          Positioned.fill(
            key: const ValueKey('update'),
            child: _UpdateRequiredScreen(
              update: notices.update,
              language: language,
            ),
          ),
      ],
    );
  }
}

/// Opens a notice's page in the browser.
Future<void> _open(WidgetRef ref, Uri uri) =>
    ref.read(noticeLinkOpenerProvider)(uri);

class _KindStyle {
  const _KindStyle(this.background, this.foreground, this.icon);

  final Color background;
  final Color foreground;
  final IconData icon;

  factory _KindStyle.of(AppColorTokens colors, AnnouncementKind kind) =>
      switch (kind) {
        AnnouncementKind.info => _KindStyle(
            colors.infoSubtle,
            colors.infoText,
            Icons.info_outline,
          ),
        AnnouncementKind.warning => _KindStyle(
            colors.warningSubtle,
            colors.warningText,
            Icons.warning_amber_rounded,
          ),
        AnnouncementKind.success => _KindStyle(
            colors.successSubtle,
            colors.successText,
            Icons.check_circle_outline,
          ),
      };
}

class _AnnouncementBanner extends ConsumerWidget {
  const _AnnouncementBanner({
    required this.message,
    required this.kind,
    required this.link,
    required this.onDismiss,
  });

  final String message;
  final AnnouncementKind kind;
  final NoticeLink link;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = _KindStyle.of(context.colors, kind);
    final language = Localizations.localeOf(context).languageCode;
    final label = link.labelFor(language);
    final uri = link.uri;
    return Material(
      key: const Key('announcement-banner'),
      color: style.background,
      child: Padding(
        padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(
                start: AppSpacing.s16,
                top: AppSpacing.s12,
              ),
              child: Icon(style.icon, key: Key('announcement-${kind.name}'), color: style.foreground),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.s8,
                  vertical: AppSpacing.s12,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      message,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: style.foreground,
                          ),
                    ),
                    if (uri != null && label != null)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.s4),
                        child: GestureDetector(
                          key: const Key('announcement-link'),
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _open(ref, uri),
                          child: Text(
                            label,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: style.foreground,
                                  fontWeight: FontWeight.w700,
                                  decoration: TextDecoration.underline,
                                  decorationColor: style.foreground,
                                ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // No tooltip: this banner sits above the app's Navigator, so there
            // is no Overlay here for one to open in. The label is for screen readers.
            IconButton(
              key: const Key('announcement-dismiss'),
              icon: Icon(
                Icons.close,
                color: style.foreground,
                semanticLabel: context.l10n.announcementDismiss,
              ),
              onPressed: onDismiss,
            ),
          ],
        ),
      ),
    );
  }
}

/// "2 h 15 min", "40 minutes", "3 days": how long until [remaining] is over.
String noticeDuration(AppLocalizations l10n, Duration remaining) {
  if (remaining.inHours >= 48) return l10n.noticeDurationDays(remaining.inDays);
  if (remaining.inMinutes >= 60) {
    return l10n.noticeDurationHoursMinutes(
      remaining.inHours,
      remaining.inMinutes % 60,
    );
  }
  // Rounded up, so "0 minutes" is never shown while time is left.
  final minutes = (remaining.inSeconds / 60).ceil();
  return l10n.noticeDurationMinutes(minutes < 1 ? 1 : minutes);
}

class _MaintenanceScreen extends ConsumerWidget {
  const _MaintenanceScreen({
    required this.message,
    required this.endsAt,
    required this.now,
    required this.link,
  });

  final String message;
  final DateTime? endsAt;
  final DateTime now;
  final NoticeLink link;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final textTheme = Theme.of(context).textTheme;
    final material = MaterialLocalizations.of(context);
    final language = Localizations.localeOf(context).languageCode;
    final end = endsAt?.toLocal();
    final remaining = end?.difference(now);
    final label = link.labelFor(language);
    final uri = link.uri;
    return Scaffold(
      key: const Key('maintenance-screen'),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.s32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.build_circle_outlined,
                  size: 72,
                  color: context.colors.warning,
                ),
                const SizedBox(height: AppSpacing.s24),
                Text(
                  l10n.maintenanceTitle,
                  style: textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.s16),
                Text(
                  message,
                  style: textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                if (end != null && remaining != null && !remaining.isNegative) ...[
                  const SizedBox(height: AppSpacing.s16),
                  Text(
                    key: const Key('maintenance-back-at'),
                    l10n.maintenanceBackAt(
                      '${material.formatMediumDate(end)}, ${material.formatTimeOfDay(TimeOfDay.fromDateTime(end))}',
                    ),
                    style: textTheme.titleSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.s4),
                  Text(
                    key: const Key('maintenance-back-in'),
                    l10n.maintenanceBackIn(noticeDuration(l10n, remaining)),
                    style: textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                ] else ...[
                  const SizedBox(height: AppSpacing.s16),
                  Text(
                    l10n.maintenanceTryLater,
                    style: textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                ],
                if (uri != null && label != null) ...[
                  const SizedBox(height: AppSpacing.s24),
                  OutlinedButton(
                    key: const Key('maintenance-link'),
                    onPressed: () => _open(ref, uri),
                    child: Text(label),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _UpdateRequiredScreen extends ConsumerWidget {
  const _UpdateRequiredScreen({required this.update, required this.language});

  final RequiredUpdate update;
  final String language;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final textTheme = Theme.of(context).textTheme;
    final uri = update.uri;
    return Scaffold(
      key: const Key('update-required-screen'),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.s32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.system_update_alt,
                  size: 72,
                  color: context.colors.iconBrand,
                ),
                const SizedBox(height: AppSpacing.s24),
                Text(
                  l10n.updateRequiredTitle,
                  style: textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.s16),
                Text(
                  update.textFor(language) ?? l10n.updateRequiredBody,
                  style: textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                if (uri != null) ...[
                  const SizedBox(height: AppSpacing.s24),
                  FilledButton(
                    key: const Key('update-required-button'),
                    onPressed: () => _open(ref, uri),
                    child: Text(l10n.updateRequiredButton),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

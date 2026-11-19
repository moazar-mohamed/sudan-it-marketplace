import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import 'site_auth.dart';
import 'site_detail_parts.dart';
import 'site_look.dart';
import 'site_orders.dart';

/// The terms and conditions Platform Admin published (platform_settings/terms),
/// as sictm.net reads them (`data/terms.ts`).
class SiteTerms {
  const SiteTerms({
    required this.version,
    required this.textAr,
    required this.textEn,
    this.updatedAt,
  });

  final int version;
  final String textAr;
  final String textEn;
  final DateTime? updatedAt;

  /// The terms as stored, or null when the document is not a published one
  /// (`mapTerms`).
  static SiteTerms? fromData(Map<String, dynamic>? d) {
    if (d == null) return null;
    final version = d['version'];
    if (version is! int || version < 1) return null;
    String text(Object? v) => v is String ? v : '';
    final stamp = d['updatedAt'];
    final terms = SiteTerms(
      version: version,
      textAr: text(d['textAr']),
      textEn: text(d['textEn']),
      updatedAt: stamp is Timestamp ? stamp.toDate() : null,
    );
    if (terms.textAr.trim().isEmpty && terms.textEn.trim().isEmpty) {
      return null;
    }
    return terms;
  }

  /// The text in [language], or in the other one when it is not written.
  String textIn(String language) {
    final own = language == 'en' ? textEn : textAr;
    final other = language == 'en' ? textAr : textEn;
    return own.trim().isNotEmpty ? own : other;
  }
}

/// The published terms, live; readable before signing in. Null when none are
/// published (or they could not be read).
final siteTermsProvider = StreamProvider<SiteTerms?>((ref) {
  final DocumentReference<Map<String, dynamic>> doc;
  try {
    doc = FirebaseFirestore.instance
        .collection('platform_settings')
        .doc('terms');
  } catch (_) {
    // No Firebase (a test, a build without it): nothing is published.
    return Stream.value(null);
  }
  return doc
      .snapshots()
      .map((snap) => SiteTerms.fromData(snap.data()))
      // A read that fails asks for nothing, as on the site.
      .handleError((Object _) {});
});

/// «الشروط والأحكام» (`pages/TermsPage.tsx`): the version, when it was last
/// updated, and the text.
class SiteTermsPage extends ConsumerWidget {
  const SiteTermsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.colors;
    final termsAsync = ref.watch(siteTermsProvider);
    final terms = termsAsync.asData?.value;
    final language = Localizations.localeOf(context).languageCode;
    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
        children: [
          SitePageTitle(l10n.siteFooterTerms),
          const SizedBox(height: 16),
          if (termsAsync.isLoading)
            const AppSkeletonList(count: 1)
          else if (terms == null)
            SiteEmptyState(title: l10n.siteTermsNone)
          else
            SiteTile(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    [
                      l10n.siteTermsVersion(terms.version),
                      if (terms.updatedAt != null)
                        l10n.siteTermsUpdated(
                          siteLongDate(context, terms.updatedAt!),
                        ),
                    ].join(' · '),
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 13,
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SelectableText(
                    terms.textIn(language),
                    style: AppTextStyles.body.copyWith(
                      height: 1.9,
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Whether a person still has to accept: terms are published and they have
/// not accepted this version (`needsTerms`). A correction that keeps the
/// version number does not ask again.
bool siteNeedsTerms(SiteTerms? terms, int? acceptedVersion) =>
    terms != null &&
    (acceptedVersion == null || acceptedVersion < terms.version);

/// Records that [uid] accepted [version] now; the rules check it is the
/// published one. False when it could not be saved.
typedef SiteTermsAcceptor = Future<bool> Function(String uid, int version);

final siteTermsAcceptorProvider = Provider<SiteTermsAcceptor>((ref) {
  return (uid, version) async {
    try {
      await FirebaseFirestore.instance.collection('users').doc(uid).update({
        'termsVersion': version,
        'termsAcceptedAt': FieldValue.serverTimestamp(),
      });
      return true;
    } catch (_) {
      return false;
    }
  };
});

/// Between signing in and the shop, for a customer who has not accepted the
/// published version (an account made before there were terms, a Google
/// sign-up, or a new version): the terms, a box to tick, «أوافق وأتابع» and
/// «تسجيل الخروج» (`TermsGate`). It cannot be dismissed, only accepted or
/// left. Shows [child] while the terms load and once they are accepted.
class SiteTermsGate extends ConsumerStatefulWidget {
  const SiteTermsGate({
    super.key,
    required this.uid,
    required this.acceptedVersion,
    required this.onAccepted,
    required this.onSignOut,
    required this.child,
  });

  final String uid;
  final int? acceptedVersion;

  /// Reloads the profile after the acceptance is saved.
  final VoidCallback onAccepted;
  final VoidCallback onSignOut;
  final Widget child;

  @override
  ConsumerState<SiteTermsGate> createState() => _SiteTermsGateState();
}

class _SiteTermsGateState extends ConsumerState<SiteTermsGate> {
  bool _agreed = false;
  bool _busy = false;
  bool _failed = false;

  /// The version accepted here, so the shop opens before the profile reloads.
  int? _acceptedHere;

  Future<void> _accept(SiteTerms terms) async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    final ok = await ref.read(siteTermsAcceptorProvider)(
      widget.uid,
      terms.version,
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _failed = !ok;
      if (ok) _acceptedHere = terms.version;
    });
    if (ok) widget.onAccepted();
  }

  @override
  Widget build(BuildContext context) {
    final terms = ref.watch(siteTermsProvider).asData?.value;
    final accepted = _acceptedHere ?? widget.acceptedVersion;
    if (!siteNeedsTerms(terms, accepted)) return widget.child;
    final l10n = context.l10n;
    final colors = context.colors;
    final language = Localizations.localeOf(context).languageCode;
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: SiteAuthCard(
                key: const ValueKey('terms-gate'),
                title: l10n.siteFooterTerms,
                subtitle: l10n.siteTermsGateSub,
                children: [
                  const SizedBox(height: 16),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 320),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colors.bgSubtle,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: SingleChildScrollView(
                      child: Text(
                        terms!.textIn(language),
                        style: AppTextStyles.body.copyWith(
                          height: 1.9,
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Checkbox(
                        key: const ValueKey('terms-gate-check'),
                        value: _agreed,
                        onChanged: _busy
                            ? null
                            : (v) => setState(() => _agreed = v ?? false),
                      ),
                      Expanded(
                        child: Text(
                          l10n.siteTermsGateCheck,
                          style: AppTextStyles.body.copyWith(fontSize: 14),
                        ),
                      ),
                    ],
                  ),
                  if (_failed)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        l10n.siteTermsGateFailed,
                        style: AppTextStyles.caption.copyWith(
                          fontSize: 14,
                          color: colors.errorText,
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  AppButton.primary(
                    key: const ValueKey('terms-gate-accept'),
                    label: l10n.siteTermsGateAccept,
                    loading: _busy,
                    expand: true,
                    onPressed: _agreed ? () => _accept(terms) : null,
                  ),
                  const SizedBox(height: 10),
                  AppButton.outlined(
                    label: l10n.commonSignOut,
                    expand: true,
                    onPressed: _busy ? null : widget.onSignOut,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

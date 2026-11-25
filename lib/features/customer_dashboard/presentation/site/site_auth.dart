import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';

/// The card of sictm.net's sign-in pages (`AuthCard`, `.login-card`): the
/// logo and the marketplace's name, a big title, a line under it, then the
/// form; [footer] (the language switch) at the bottom.
class SiteAuthCard extends StatelessWidget {
  const SiteAuthCard({
    super.key,
    required this.title,
    this.subtitle,
    required this.children,
    this.footer,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final narrow = MediaQuery.sizeOf(context).width < 420;
    return Container(
      padding: EdgeInsets.all(narrow ? 24 : 36),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.borderDefault),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A0B1D3A),
            blurRadius: 32,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const AppLogoMark(size: 38),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  context.l10n.appName,
                  style: AppTextStyles.h3.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Semantics(
            header: true,
            child: Text(
              title,
              style: AppTextStyles.h1.copyWith(
                fontSize: 26,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle!,
              style: AppTextStyles.body.copyWith(
                height: 1.7,
                color: colors.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: 8),
          ...children,
          if (footer != null) ...[const SizedBox(height: 16), footer!],
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';

/// Three promises under the categories: delivery, installation and verified
/// companies. Plain information, not buttons.
class HomeTrustStrip extends StatelessWidget {
  const HomeTrustStrip({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = context.l10n;
    final items = [
      (Icons.local_shipping_outlined, l10n.homeTrustDelivery),
      (Icons.build_outlined, l10n.homeTrustInstallation),
      (Icons.verified_user_outlined, l10n.homeVerifiedCompanies),
    ];
    return Container(
      key: const ValueKey('home-trust-strip'),
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderDefault),
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) VerticalDivider(width: 1, color: colors.borderDefault),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.s4,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        items[i].$1,
                        size: AppSize.iconLg - 2,
                        color: colors.iconBrand,
                      ),
                      const SizedBox(height: AppSpacing.s4),
                      Text(
                        items[i].$2,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption.copyWith(
                          color: colors.textSecondary,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

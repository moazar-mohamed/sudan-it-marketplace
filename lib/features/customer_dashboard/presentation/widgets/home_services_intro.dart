import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';

/// "Need a technician?": what the Services tab is for, with the button that
/// takes the customer down to the services.
class HomeServiceBanner extends StatelessWidget {
  const HomeServiceBanner({super.key, required this.onRequest});

  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = context.l10n;
    return Container(
      key: const ValueKey('home-service-banner'),
      padding: const EdgeInsets.all(AppSpacing.s16),
      decoration: BoxDecoration(
        color: colors.brandPrimarySubtle,
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeServiceBannerTitle,
                  style: AppTextStyles.h1.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.s4),
                Text(
                  l10n.homeServiceBannerBody,
                  style: AppTextStyles.body.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.s12),
                AppButton.primary(
                  key: const ValueKey('home-service-banner-action'),
                  label: l10n.serviceRequestAction,
                  onPressed: onRequest,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.s12),
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: colors.surface,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.build_rounded, size: 40, color: colors.iconBrand),
          ),
        ],
      ),
    );
  }
}

/// The three steps of asking for a service: describe, compare, get a visit.
class HomeServiceSteps extends StatelessWidget {
  const HomeServiceSteps({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = context.l10n;
    final steps = [
      l10n.homeStepDescribe,
      l10n.homeStepCompare,
      l10n.homeStepArrives,
    ];
    return Container(
      key: const ValueKey('home-service-steps'),
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderDefault),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < steps.length; i++)
            Expanded(
              child: Column(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: colors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '${i + 1}',
                      style: AppTextStyles.bodyStrong.copyWith(
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s8),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.s4,
                    ),
                    child: Text(
                      steps[i],
                      maxLines: 2,
                      textAlign: TextAlign.center,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.caption.copyWith(
                        color: colors.textSecondary,
                        height: 1.3,
                      ),
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../technicians/presentation/technicians_providers.dart';
import '../profile/company_profile_screen.dart';
import '../reviews/company_reviews_screen.dart';
import '../technicians/technicians_screen.dart';

/// The company's Account tab: who the company is (opens its profile) and
/// the team. Settings sit in the app bar; adding things is the Add button.
class CompanyAccountTab extends ConsumerWidget {
  const CompanyAccountTab({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final company = ref.watch(companyStreamProvider(companyId)).asData?.value;
    final technicians =
        ref.watch(companyTechniciansStreamProvider(companyId)).asData?.value;
    final active = technicians?.where((t) => t.isActive).length;

    void open(Widget screen) => Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => screen));

    return AppCenteredList(
      children: [
        AppCard(
          key: const ValueKey('account-company'),
          padding: const EdgeInsets.all(AppSpacing.s16),
          onTap: () => open(CompanyProfileScreen(companyId: companyId)),
          child: Row(
            children: [
              AppAvatar(
                name: company?.name ?? '',
                imageUrl: company?.logoUrl,
                size: AppSize.avatarLg,
              ),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      company?.name ?? l10n.adminCompanyProfile,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.h3,
                    ),
                    const SizedBox(height: AppSpacing.s2),
                    Text(
                      l10n.adminAccountViewProfile,
                      style: AppTextStyles.caption.copyWith(
                        color: context.colors.textBrand,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: context.colors.iconMuted),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.s12),
        AppListCard(
          key: const ValueKey('account-technicians'),
          onTap: () => open(TechniciansScreen(companyId: companyId)),
          leading: const AppIconTile(
            icon: Icons.engineering_outlined,
            size: 40,
            iconSize: AppSize.iconMd,
          ),
          content: Text(l10n.navTechnicians, style: AppTextStyles.bodyStrong),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (active != null)
                Text(
                  l10n.adminTechniciansActive(active),
                  style: AppTextStyles.body.copyWith(
                    color: context.colors.textSecondary,
                  ),
                ),
              const SizedBox(width: AppSpacing.s4),
              Icon(
                Icons.chevron_right_rounded,
                color: context.colors.iconMuted,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.s12),
        CompanyReviewsRow(companyId: companyId),
      ],
    );
  }
}

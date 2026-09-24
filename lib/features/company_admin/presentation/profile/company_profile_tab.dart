import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/presentation/auth_controller.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../location/presentation/widgets/map_widgets.dart';
import '../../../location/presentation/widgets/open_location_button.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../widgets/admin_section_card.dart';
import 'edit_company_profile_screen.dart';
import 'payment_accounts_screen.dart';
import '../../../../core/localization/l10n_extension.dart';

class CompanyProfileTab extends ConsumerWidget {
  const CompanyProfileTab({super.key, required this.companyId});

  final String companyId;

  String _orDash(String? value) =>
      (value == null || value.trim().isEmpty) ? '—' : value.trim();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final companyAsync = ref.watch(companyStreamProvider(companyId));
    final signOutButton = AppButton.destructiveOutlined(
      onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
      icon: Icons.logout,
      label: context.l10n.commonSignOut,
      expand: true,
    );

    return companyAsync.when(
      loading: () => const AppLoadingState(),
      error: (_, _) => AppCenteredList(
        children: [
          AppErrorState(
            message: context.l10n.adminCompanyLoadFailed,
            onRetry: () => ref.invalidate(companyStreamProvider(companyId)),
          ),
          signOutButton,
        ],
      ),
      data: (company) {
        if (company == null) {
          return AppCenteredList(
            children: [
              AppEmptyState(
                icon: Icons.business_outlined,
                message: context.l10n.adminCompanyNotFound,
              ),
              signOutButton,
            ],
          );
        }
        return AppCenteredList(
          bottomPadding: AppSpacing.s32,
          children: [
            Center(
              child: AppImageTile(
                imageUrl: company.logoUrl,
                fallbackIcon: Icons.business_outlined,
                size: 88,
                radius: AppRadius.lg,
              ),
            ),
            const SizedBox(height: AppSpacing.s12),
            Text(
              company.name,
              textAlign: TextAlign.center,
              style: AppTextStyles.h2,
            ),
            if ((company.description ?? '').trim().isNotEmpty) ...[
              const SizedBox(height: AppSpacing.s4),
              Text(
                company.description!,
                textAlign: TextAlign.center,
                style: AppTextStyles.body
                    .copyWith(color: AppColors.textSecondary),
              ),
            ],
            const SizedBox(height: AppSpacing.s16),
            AdminSectionCard(
              title: context.l10n.adminContact,
              children: [
                AdminInfoRow(label: context.l10n.adminPhone, value: _orDash(company.phone)),
                AdminInfoRow(label: context.l10n.authEmail, value: _orDash(company.email)),
              ],
            ),
            const SizedBox(height: AppSpacing.s12),
            AdminSectionCard(
              title: context.l10n.adminLocation,
              children: [
                AdminInfoRow(label: context.l10n.adminCity, value: _orDash(company.city)),
                AdminInfoRow(label: context.l10n.orderAddress, value: _orDash(company.address)),
                AdminInfoRow(
                  label: context.l10n.checkoutPickupLocation,
                  value: _orDash(company.pickupAddress),
                ),
                if (company.coordinates != null) ...[
                  const SizedBox(height: AppSpacing.s6),
                  CoordinatesText(location: company.coordinates!),
                  const SizedBox(height: AppSpacing.s8),
                  OpenLocationButton(
                    label: LocationStrings.of(context).viewOnMap,
                    viewerTitle: company.name,
                    coordinates: company.coordinates,
                    text: company.locationText,
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.s12),
            AdminSectionCard(
              title: context.l10n.paymentAccountsManage,
              trailing: AppButton.text(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => PaymentAccountsScreen(companyId: company.id),
                  ),
                ),
                icon: Icons.account_balance_outlined,
                label: context.l10n.commonEdit,
              ),
              children: [
                if (company.paymentAccounts.isEmpty)
                  Text(
                    context.l10n.paymentAccountsEmpty,
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                for (final account in company.paymentAccounts)
                  AdminInfoRow(
                    label: account.bankName,
                    value: account.accountNumber,
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.s20),
            AppButton.primary(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => EditCompanyProfileScreen(company: company),
                ),
              ),
              icon: Icons.edit_outlined,
              label: context.l10n.adminEditCompanyProfile,
              expand: true,
            ),
            const SizedBox(height: AppSpacing.s12),
            signOutButton,
          ],
        );
      },
    );
  }
}

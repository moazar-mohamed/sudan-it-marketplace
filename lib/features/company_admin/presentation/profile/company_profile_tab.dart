import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/presentation/auth_controller.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../location/presentation/widgets/map_widgets.dart';
import '../../../location/presentation/widgets/open_location_button.dart';
import '../widgets/admin_network_image.dart';
import '../widgets/admin_section_card.dart';
import 'edit_company_profile_screen.dart';

class CompanyProfileTab extends ConsumerWidget {
  const CompanyProfileTab({super.key, required this.companyId});

  final String companyId;

  String _orDash(String? value) =>
      (value == null || value.trim().isEmpty) ? '—' : value.trim();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final companyAsync = ref.watch(companyStreamProvider(companyId));
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final signOutButton = OutlinedButton.icon(
      onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
      icon: Icon(Icons.logout, color: colorScheme.error),
      label: Text('Sign out', style: TextStyle(color: colorScheme.error)),
    );

    return companyAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminErrorState(
            message: 'Could not load your company profile.',
            onRetry: () => ref.invalidate(companyStreamProvider(companyId)),
          ),
          signOutButton,
        ],
      ),
      data: (company) {
        if (company == null) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const AdminEmptyState(
                icon: Icons.business_outlined,
                message:
                    'Your company record was not found. Please contact the platform administrator.',
              ),
              signOutButton,
            ],
          );
        }
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Center(
              child: AdminNetworkImage(
                url: company.logoUrl,
                fallbackIcon: Icons.business_outlined,
                size: 88,
                radius: 20,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              company.name,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            if ((company.description ?? '').trim().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                company.description!,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
            ],
            const SizedBox(height: 16),
            AdminSectionCard(
              title: 'Contact',
              children: [
                AdminInfoRow(label: 'Phone', value: _orDash(company.phone)),
                AdminInfoRow(label: 'Email', value: _orDash(company.email)),
              ],
            ),
            const SizedBox(height: 12),
            AdminSectionCard(
              title: 'Location',
              children: [
                AdminInfoRow(label: 'City', value: _orDash(company.city)),
                AdminInfoRow(label: 'Address', value: _orDash(company.address)),
                AdminInfoRow(
                  label: 'Pickup Location',
                  value: _orDash(company.pickupAddress),
                ),
                if (company.coordinates != null) ...[
                  const SizedBox(height: 6),
                  CoordinatesText(location: company.coordinates!),
                  const SizedBox(height: 10),
                  OpenLocationButton(
                    label: LocationStrings.of(context).viewOnMap,
                    viewerTitle: company.name,
                    coordinates: company.coordinates,
                    text: company.locationText,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => EditCompanyProfileScreen(company: company),
                ),
              ),
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Edit Company Profile'),
            ),
            const SizedBox(height: 12),
            signOutButton,
          ],
        );
      },
    );
  }
}

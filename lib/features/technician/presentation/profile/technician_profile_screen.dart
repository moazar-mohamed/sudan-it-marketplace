import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/domain/entities/user_profile.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../customer_dashboard/presentation/profile_controller.dart';
import '../../../location/domain/geo_location.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../location/presentation/widgets/open_location_button.dart';
import '../widgets/technician_widgets.dart';
import '../../../../core/localization/l10n_extension.dart';

class TechnicianProfileScreen extends ConsumerStatefulWidget {
  const TechnicianProfileScreen({
    super.key,
    required this.companyId,
    required this.technicianPhone,
  });

  final String companyId;
  final String technicianPhone;

  @override
  ConsumerState<TechnicianProfileScreen> createState() =>
      _TechnicianProfileScreenState();
}

class _TechnicianProfileScreenState extends ConsumerState<TechnicianProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  bool _isEditing = false;
  bool _isSaving = false;
  bool _hasLoadedFormValues = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _loadFormValues(String fullName) {
    if (_hasLoadedFormValues || _isEditing) {
      return;
    }
    _nameController.text = fullName;
    _hasLoadedFormValues = true;
  }

  void _startEditing(String fullName) {
    _nameController.text = fullName;
    setState(() => _isEditing = true);
  }

  Future<void> _save() async {
    if (_isSaving || !(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    setState(() => _isSaving = true);
    final error = await ref.read(profileControllerProvider.notifier).updateProfile(
          fullName: _nameController.text,
        );
    if (!mounted) {
      return;
    }
    setState(() {
      _isSaving = false;
      _isEditing = error != null;
    });
    showAppSnackBar(
      context,
      error ?? context.l10n.profileUpdated,
      tone: error == null ? AppTone.success : AppTone.error,
    );
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileControllerProvider);
    final company = ref.watch(resolvedCompanyProvider(widget.companyId));

    return profileAsync.when(
      loading: () => const AppLoadingState(),
      error: (_, _) => TechnicianErrorState(
        message: context.l10n.techProfileLoadFailed,
      ),
      data: (profile) {
        if (profile == null) {
          return TechnicianErrorState(
            message: context.l10n.errorProfileNotFound,
          );
        }
        _loadFormValues(profile.fullName);
        return _TechnicianProfileContent(
          profile: profile,
          companyName: company?.name ?? '—',
          companyLocationText: company?.locationText,
          companyCoordinates: company?.coordinates,
          phone: widget.technicianPhone,
          formKey: _formKey,
          nameController: _nameController,
          isEditing: _isEditing,
          isSaving: _isSaving,
          onEdit: () => _startEditing(profile.fullName),
          onCancel: () => setState(() => _isEditing = false),
          onSave: _save,
          onSignOut: () => ref.read(authControllerProvider.notifier).signOut(),
        );
      },
    );
  }
}

class _TechnicianProfileContent extends StatelessWidget {
  const _TechnicianProfileContent({
    required this.profile,
    required this.companyName,
    required this.companyLocationText,
    required this.companyCoordinates,
    required this.phone,
    required this.formKey,
    required this.nameController,
    required this.isEditing,
    required this.isSaving,
    required this.onEdit,
    required this.onCancel,
    required this.onSave,
    required this.onSignOut,
  });

  final UserProfile profile;
  final String companyName;

  /// Read-only company location, shown only here in the technician's own
  /// Company section (never derived from an order).
  final String? companyLocationText;
  final GeoLocation? companyCoordinates;
  final String phone;
  final GlobalKey<FormState> formKey;
  final TextEditingController nameController;
  final bool isEditing;
  final bool isSaving;
  final VoidCallback onEdit;
  final VoidCallback onCancel;
  final VoidCallback onSave;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return AppCenteredList(
      children: [
        const Center(
          child: AppIconTile(
            icon: Icons.engineering_outlined,
            size: 72,
            radius: AppRadius.full,
          ),
        ),
        const SizedBox(height: AppSpacing.s20),
        TechnicianSectionCard(
          title: l10n.techCompany,
          children: [
            TechnicianInfoRow(label: l10n.techCompany, value: companyName),
            if (companyLocationText != null || companyCoordinates != null) ...[
              const SizedBox(height: AppSpacing.s8),
              CompanyLocationBlock(
                text: companyLocationText,
                coordinates: companyCoordinates,
                actionLabel: LocationStrings.of(context).viewCompanyLocation,
                viewerTitle: companyName,
              ),
            ],
          ],
        ),
        const SizedBox(height: AppSpacing.s12),
        Form(
          key: formKey,
          child: TechnicianSectionCard(
            title: l10n.techMyDetails,
            children: [
              AppTextField(
                label: l10n.profileFullName,
                controller: nameController,
                enabled: isEditing && !isSaving,
                textCapitalization: TextCapitalization.words,
                prefixIcon: Icons.person_outline,
                validator: (value) => value == null || value.trim().isEmpty
                    ? l10n.profileFullNameRequired
                    : null,
              ),
              const SizedBox(height: AppSpacing.s16),
              AppTextField(
                label: l10n.authEmail,
                initialValue: profile.email,
                enabled: false,
                prefixIcon: Icons.email_outlined,
              ),
              const SizedBox(height: AppSpacing.s16),
              AppTextField(
                label: l10n.adminPhone,
                initialValue: phone,
                enabled: false,
                prefixIcon: Icons.phone_outlined,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.s20),
        if (isEditing)
          Row(
            children: [
              Expanded(
                child: AppButton.outlined(
                  label: l10n.commonCancel,
                  onPressed: isSaving ? null : onCancel,
                ),
              ),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: AppButton.primary(
                  label: l10n.commonSaveChanges,
                  loading: isSaving,
                  onPressed: onSave,
                ),
              ),
            ],
          )
        else
          AppButton.outlined(
            icon: Icons.edit_outlined,
            label: l10n.techEditName,
            expand: true,
            onPressed: onEdit,
          ),
        const SizedBox(height: AppSpacing.s20),
        AppButton.destructiveOutlined(
          icon: Icons.logout,
          label: l10n.commonSignOut,
          expand: true,
          onPressed: onSignOut,
        ),
      ],
    );
  }
}

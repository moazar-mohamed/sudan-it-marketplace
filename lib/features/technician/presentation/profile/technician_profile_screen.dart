import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/phone_number.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/domain/entities/user_profile.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../chats/presentation/chat_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../push/domain/push_categories.dart';
import '../../../push/presentation/push_preference.dart';
import '../../../technicians/presentation/technicians_providers.dart';
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
    required this.technicianId,
    required this.technicianPhone,
  });

  final String companyId;
  final String technicianId;
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
          technicianId: widget.technicianId,
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

class _TechnicianProfileContent extends ConsumerWidget {
  const _TechnicianProfileContent({
    required this.profile,
    required this.companyName,
    required this.companyLocationText,
    required this.companyCoordinates,
    required this.phone,
    required this.technicianId,
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
  final String technicianId;
  final GlobalKey<FormState> formKey;
  final TextEditingController nameController;
  final bool isEditing;
  final bool isSaving;
  final VoidCallback onEdit;
  final VoidCallback onCancel;
  final VoidCallback onSave;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final jobs =
        ref.watch(technicianOrdersStreamProvider(technicianId)).asData?.value ??
            const <OrderEntity>[];
    final done =
        jobs.where((j) => j.orderStatus == OrderStatus.completed).length;
    final record = ref.watch(technicianByUidProvider(technicianId)).asData?.value;
    final available = record?.isAvailable ?? true;
    final prefs = ref.watch(pushPrefsProvider).asData?.value ?? const PushPrefs();

    return AppCenteredList(
      children: [
        const Center(
          child: AppIconTile(
            icon: Icons.engineering_outlined,
            size: 72,
            radius: AppRadius.full,
          ),
        ),
        const SizedBox(height: AppSpacing.s8),
        Center(
          child: Text(profile.fullName, style: AppTextStyles.h3),
        ),
        Center(
          child: Text(
            companyName,
            style: AppTextStyles.caption
                .copyWith(color: context.colors.textSecondary),
          ),
        ),
        const SizedBox(height: AppSpacing.s12),
        AppCard(
          child: Row(
            children: [
              Text('$done', style: AppTextStyles.stat),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: Text(
                  l10n.tjCompletedJobs,
                  style: AppTextStyles.body
                      .copyWith(color: context.colors.textSecondary),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.s12),
        AppCard(
          child: Column(
            children: [
              SwitchListTile(
                key: const ValueKey('technician-availability'),
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.tjAvailabilityTitle),
                subtitle: Text(l10n.tjAvailabilityHint),
                value: available,
                onChanged: record == null
                    ? null
                    : (value) => ref
                        .read(techniciansRepositoryProvider)
                        .setAvailability(technicianId, available: value)
                        .catchError((Object _) {
                      if (context.mounted) {
                        showAppSnackBar(
                          context,
                          l10n.tjAvailabilityFailed,
                          tone: AppTone.error,
                        );
                      }
                    }),
              ),
              SwitchListTile(
                  key: const ValueKey('technician-job-notifications'),
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.tjJobNotificationsTitle),
                  value: prefs.isOn(PushCategory.orders),
                  onChanged: (value) {
                    final uid = ref.read(currentUserIdProvider);
                    if (uid == null) return;
                    ref
                        .read(pushPrefsStoreProvider)
                        .set(uid, PushCategory.orders, value)
                        .catchError((Object _) {});
                  },
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.s12),
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
                initialValue: displayPhone(phone),
                enabled: false,
                textDirection: TextDirection.ltr,
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

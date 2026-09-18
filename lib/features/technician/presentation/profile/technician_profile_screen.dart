import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../auth/domain/entities/user_profile.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../customer_dashboard/presentation/profile_controller.dart';
import '../widgets/technician_widgets.dart';

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
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(error ?? 'Profile updated successfully.'),
          backgroundColor: error == null ? null : AppColors.error,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileControllerProvider);
    final company = ref.watch(resolvedCompanyProvider(widget.companyId));

    return profileAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => const TechnicianErrorState(
        message: 'Could not load your profile.',
      ),
      data: (profile) {
        if (profile == null) {
          return const TechnicianErrorState(
            message: 'Your profile could not be found.',
          );
        }
        _loadFormValues(profile.fullName);
        return _TechnicianProfileContent(
          profile: profile,
          companyName: company?.name ?? '—',
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
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: CircleAvatar(
            radius: 36,
            backgroundColor: colorScheme.primary.withValues(alpha: 0.12),
            foregroundColor: colorScheme.primary,
            child: const Icon(Icons.engineering_outlined, size: 40),
          ),
        ),
        const SizedBox(height: 20),
        TechnicianSectionCard(
          title: 'Company',
          children: [
            TechnicianInfoRow(label: 'Company', value: companyName),
          ],
        ),
        const SizedBox(height: 12),
        Form(
          key: formKey,
          child: TechnicianSectionCard(
            title: 'My Details',
            children: [
              TextFormField(
                controller: nameController,
                enabled: isEditing && !isSaving,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Full name',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Enter your full name.'
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: profile.email,
                enabled: false,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: phone,
                enabled: false,
                decoration: const InputDecoration(
                  labelText: 'Phone',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        if (isEditing)
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: isSaving ? null : onCancel,
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: isSaving ? null : onSave,
                  child: isSaving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save changes'),
                ),
              ),
            ],
          )
        else
          OutlinedButton.icon(
            onPressed: onEdit,
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Edit name'),
          ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: onSignOut,
          icon: Icon(Icons.logout, color: colorScheme.error),
          label: Text('Sign out', style: TextStyle(color: colorScheme.error)),
        ),
      ],
    );
  }
}

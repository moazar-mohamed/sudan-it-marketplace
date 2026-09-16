import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../auth/domain/entities/user_profile.dart';
import '../../auth/domain/exceptions/auth_exception.dart';
import 'profile_controller.dart';

class CustomerProfileScreen extends ConsumerStatefulWidget {
  const CustomerProfileScreen({super.key});

  @override
  ConsumerState<CustomerProfileScreen> createState() =>
      _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends ConsumerState<CustomerProfileScreen> {
  final _profileFormKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  bool _isEditing = false;
  bool _isSaving = false;
  bool _hasLoadedFormValues = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _loadFormValues(String fullName, String? phone) {
    if (_hasLoadedFormValues || _isEditing) {
      return;
    }
    _nameController.text = fullName;
    _phoneController.text = phone ?? '';
    _hasLoadedFormValues = true;
  }

  void _startEditing(String fullName, String? phone) {
    _nameController.text = fullName;
    _phoneController.text = phone ?? '';
    setState(() => _isEditing = true);
  }

  void _cancelEditing() {
    setState(() => _isEditing = false);
  }

  Future<void> _saveProfile() async {
    if (_isSaving || !(_profileFormKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _isSaving = true);
    final error = await ref.read(profileControllerProvider.notifier).updateProfile(
          fullName: _nameController.text,
          phone: _phoneController.text,
        );
    if (!mounted) {
      return;
    }

    setState(() {
      _isSaving = false;
      _isEditing = error != null;
    });
    _showMessage(
      error ?? 'Profile updated successfully.',
      isError: error != null,
    );
  }

  Future<void> _showChangePasswordSheet() async {
    final currentPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    var obscureCurrentPassword = true;
    var obscureNewPassword = true;
    var obscureConfirmPassword = true;
    var isSubmitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> submit() async {
              if (isSubmitting || !(formKey.currentState?.validate() ?? false)) {
                return;
              }
              setSheetState(() => isSubmitting = true);
              final error = await ref
                  .read(profileControllerProvider.notifier)
                  .changePassword(
                    currentPassword: currentPasswordController.text,
                    newPassword: newPasswordController.text,
                  );
              if (!sheetContext.mounted) {
                return;
              }
              setSheetState(() => isSubmitting = false);
              if (error == null) {
                Navigator.of(sheetContext).pop();
                _showMessage('Password changed successfully.');
              } else {
                _showMessage(error, isError: true);
              }
            }

            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  24,
                  24,
                  24,
                  MediaQuery.viewInsetsOf(sheetContext).bottom + 24,
                ),
                child: Form(
                  key: formKey,
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Change password',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: currentPasswordController,
                          obscureText: obscureCurrentPassword,
                          decoration: InputDecoration(
                            labelText: 'Current password',
                            suffixIcon: IconButton(
                              onPressed: () => setSheetState(
                                () => obscureCurrentPassword =
                                    !obscureCurrentPassword,
                              ),
                              icon: Icon(
                                obscureCurrentPassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                          validator: (value) => value == null || value.isEmpty
                              ? 'Enter your current password.'
                              : null,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: newPasswordController,
                          obscureText: obscureNewPassword,
                          decoration: InputDecoration(
                            labelText: 'New password',
                            suffixIcon: IconButton(
                              onPressed: () => setSheetState(
                                () => obscureNewPassword = !obscureNewPassword,
                              ),
                              icon: Icon(
                                obscureNewPassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Enter a new password.';
                            }
                            if (value.length < 6) {
                              return 'Use at least 6 characters.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: confirmPasswordController,
                          obscureText: obscureConfirmPassword,
                          decoration: InputDecoration(
                            labelText: 'Confirm new password',
                            suffixIcon: IconButton(
                              onPressed: () => setSheetState(
                                () => obscureConfirmPassword =
                                    !obscureConfirmPassword,
                              ),
                              icon: Icon(
                                obscureConfirmPassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Confirm your new password.';
                            }
                            if (value != newPasswordController.text) {
                              return 'Passwords do not match.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton(
                          onPressed: isSubmitting ? null : submit,
                          child: isSubmitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Update password'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    currentPasswordController.dispose();
    newPasswordController.dispose();
    confirmPasswordController.dispose();
  }

  void _showMessage(String message, {bool isError = false}) {
    final colorScheme = Theme.of(context).colorScheme;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: isError ? colorScheme.error : null,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileControllerProvider);

    return profileAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ProfileFailure(
        message: error is AuthException
            ? error.message
            : 'Could not load your profile. Please try again.',
        onRetry: () => ref.invalidate(profileControllerProvider),
        onSignOut: () => ref.read(authControllerProvider.notifier).signOut(),
      ),
      data: (profile) {
        if (profile == null) {
          return _ProfileFailure(
            message: 'Your profile could not be found.',
            onRetry: () => ref.invalidate(profileControllerProvider),
            onSignOut: () =>
                ref.read(authControllerProvider.notifier).signOut(),
          );
        }
        _loadFormValues(profile.fullName, profile.phone);
        return _ProfileContent(
          profile: profile,
          formKey: _profileFormKey,
          nameController: _nameController,
          phoneController: _phoneController,
          isEditing: _isEditing,
          isSaving: _isSaving,
          onEdit: () => _startEditing(profile.fullName, profile.phone),
          onCancel: _cancelEditing,
          onSave: _saveProfile,
          onChangePassword: _showChangePasswordSheet,
          onSignOut: () => ref.read(authControllerProvider.notifier).signOut(),
        );
      },
    );
  }
}

class _ProfileContent extends StatelessWidget {
  const _ProfileContent({
    required this.profile,
    required this.formKey,
    required this.nameController,
    required this.phoneController,
    required this.isEditing,
    required this.isSaving,
    required this.onEdit,
    required this.onCancel,
    required this.onSave,
    required this.onChangePassword,
    required this.onSignOut,
  });

  final UserProfile profile;
  final GlobalKey<FormState> formKey;
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final bool isEditing;
  final bool isSaving;
  final VoidCallback onEdit;
  final VoidCallback onCancel;
  final VoidCallback onSave;
  final VoidCallback onChangePassword;
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
            child: const Icon(Icons.person_outline, size: 40),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'My profile',
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 24),
        Form(
          key: formKey,
          child: Column(
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
                controller: phoneController,
                enabled: isEditing && !isSaving,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
                ],
                decoration: const InputDecoration(
                  labelText: 'Phone number',
                  hintText: 'Optional',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                validator: (value) {
                  final phone = value?.trim() ?? '';
                  if (phone.isEmpty) {
                    return null;
                  }
                  final digitsOnly = phone.replaceAll(RegExp(r'[^0-9]'), '');
                  if (digitsOnly.length < 9) {
                    return 'Enter a valid phone number';
                  }
                  return null;
                },
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
            label: const Text('Edit profile'),
          ),
        const SizedBox(height: 12),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(Icons.lock_outline, color: colorScheme.primary),
          title: const Text('Change password'),
          subtitle: const Text('Update your account password'),
          trailing: const Icon(Icons.chevron_right),
          onTap: onChangePassword,
        ),
        const Divider(),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: onSignOut,
          icon: Icon(Icons.logout, color: colorScheme.error),
          label: Text(
            'Sign out',
            style: TextStyle(color: colorScheme.error),
          ),
        ),
      ],
    );
  }
}

class _ProfileFailure extends StatelessWidget {
  const _ProfileFailure({
    this.message = 'Could not load your profile. Please try again.',
    required this.onRetry,
    this.onSignOut,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback? onSignOut;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.person_off_outlined,
              size: 56,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
            if (onSignOut != null)
              TextButton(onPressed: onSignOut, child: const Text('Sign out')),
          ],
        ),
      ),
    );
  }
}

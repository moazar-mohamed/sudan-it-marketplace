import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/services/image_upload_service.dart';
import '../../../core/widgets/image_picker_field.dart';
import '../../../core/widgets/image_picker_strings.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_state.dart';
import '../../auth/domain/entities/user_profile.dart';
import '../../auth/domain/exceptions/auth_exception.dart';
import 'profile_controller.dart';
import '../../auth/presentation/auth_error_messages.dart';
import '../../../core/localization/l10n_extension.dart';

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
  final _photoController = ImagePickerController();

  bool _isEditing = false;
  bool _isSaving = false;
  bool _hasLoadedFormValues = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _photoController.dispose();
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

  void _startEditing(UserProfile profile) {
    _nameController.text = profile.fullName;
    _phoneController.text = profile.phone ?? '';
    _photoController.reset(profile.photoUrl);
    setState(() => _isEditing = true);
  }

  void _cancelEditing(UserProfile profile) {
    _photoController.reset(profile.photoUrl);
    setState(() => _isEditing = false);
  }

  Future<void> _saveProfile(UserProfile profile) async {
    if (_isSaving || !(_profileFormKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _isSaving = true);

    final String photoUrl;
    try {
      photoUrl = await _photoController.resolveUrl(
        ref.read(imageUploadServiceProvider),
        folder: 'profile-images/${profile.id}',
      );
    } on ImageUploadException {
      if (!mounted) {
        return;
      }
      setState(() => _isSaving = false);
      _showMessage(ImagePickerStrings.of(context).uploadFailed, isError: true);
      return;
    }

    final error = await ref.read(profileControllerProvider.notifier).updateProfile(
          fullName: _nameController.text,
          phone: _phoneController.text,
          // Only written when the picture actually changed ('' removes it).
          photoUrl: photoUrl == (profile.photoUrl ?? '') ? null : photoUrl,
        );
    if (!mounted) {
      return;
    }

    setState(() {
      _isSaving = false;
      _isEditing = error != null;
    });
    _showMessage(
      error ?? context.l10n.profileUpdated,
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
                _showMessage(context.l10n.profilePasswordChanged);
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
                          context.l10n.profileChangePassword,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: currentPasswordController,
                          obscureText: obscureCurrentPassword,
                          decoration: InputDecoration(
                            labelText: context.l10n.profileCurrentPassword,
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
                              ? context.l10n.profileCurrentPasswordRequired
                              : null,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: newPasswordController,
                          obscureText: obscureNewPassword,
                          decoration: InputDecoration(
                            labelText: context.l10n.passwordChangeNew,
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
                              return context.l10n.passwordChangeNewRequired;
                            }
                            if (value.length < 6) {
                              return context.l10n.profilePasswordMin;
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: confirmPasswordController,
                          obscureText: obscureConfirmPassword,
                          decoration: InputDecoration(
                            labelText: context.l10n.passwordChangeConfirm,
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
                              return context.l10n.profileConfirmPasswordRequired;
                            }
                            if (value != newPasswordController.text) {
                              return context.l10n.authPasswordsMismatch;
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
                              : Text(context.l10n.profileUpdatePassword),
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
    // "Nobody is signed in" and "signed in, but this user has no profile" are
    // different things; the profile provider reports both as no profile.
    final isSignedIn = ref.watch(authControllerProvider) is AuthAuthenticated;

    return profileAsync.when(
      loading: () => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 24),
            TextButton.icon(
              onPressed: () =>
                  ref.read(authControllerProvider.notifier).signOut(),
              icon: const Icon(Icons.logout),
              label: Text(context.l10n.commonSignOut),
            ),
          ],
        ),
      ),
      error: (error, _) => _ProfileFailure(
        message: error is AuthException
            ? authErrorMessage(context.l10n, error.code)
            : context.l10n.errorProfileLoad,
        onRetry: () => ref.invalidate(profileControllerProvider),
        onSignOut: () => ref.read(authControllerProvider.notifier).signOut(),
      ),
      data: (profile) {
        if (profile == null) {
          if (!isSignedIn) {
            // Signed out (the app is on its way to the login screen): there is
            // no profile to find, so do not claim one is missing.
            return const SizedBox.shrink();
          }
          return _ProfileFailure(
            message: context.l10n.errorProfileNotFound,
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
          photoController: _photoController,
          isEditing: _isEditing,
          isSaving: _isSaving,
          onEdit: () => _startEditing(profile),
          onCancel: () => _cancelEditing(profile),
          onSave: () => _saveProfile(profile),
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
    required this.photoController,
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
  final ImagePickerController photoController;
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
        if (isEditing)
          ImagePickerField(
            controller: photoController,
            enabled: !isSaving,
            shape: ImagePickerShape.circle,
            fallbackIcon: Icons.person_outline,
          )
        else
          Center(child: _ProfileAvatar(photoUrl: profile.photoUrl)),
        const SizedBox(height: 12),
        Text(
          context.l10n.profileMyProfile,
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
                decoration: InputDecoration(
                  labelText: context.l10n.profileFullName,
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? context.l10n.profileFullNameRequired
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: profile.email,
                enabled: false,
                decoration: InputDecoration(
                  labelText: context.l10n.authEmail,
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
                decoration: InputDecoration(
                  labelText: context.l10n.profilePhoneNumber,
                  hintText: context.l10n.commonOptional,
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                validator: (value) {
                  final phone = value?.trim() ?? '';
                  if (phone.isEmpty) {
                    return null;
                  }
                  final digitsOnly = phone.replaceAll(RegExp(r'[^0-9]'), '');
                  if (digitsOnly.length < 9) {
                    return context.l10n.commonPhoneInvalid;
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
                  child: Text(context.l10n.commonCancel),
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
                      : Text(context.l10n.commonSaveChanges),
                ),
              ),
            ],
          )
        else
          OutlinedButton.icon(
            onPressed: onEdit,
            icon: const Icon(Icons.edit_outlined),
            label: Text(context.l10n.profileEdit),
          ),
        const SizedBox(height: 12),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(Icons.lock_outline, color: colorScheme.primary),
          title: Text(context.l10n.profileChangePassword),
          subtitle: Text(context.l10n.profileChangePasswordSubtitle),
          trailing: const Icon(Icons.chevron_right),
          onTap: onChangePassword,
        ),
        const Divider(),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: onSignOut,
          icon: Icon(Icons.logout, color: colorScheme.error),
          label: Text(
            context.l10n.commonSignOut,
            style: TextStyle(color: colorScheme.error),
          ),
        ),
      ],
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.photoUrl});

  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final fallback = ColoredBox(
      color: colorScheme.primary.withValues(alpha: 0.12),
      child: Center(
        child: Icon(Icons.person_outline, size: 40, color: colorScheme.primary),
      ),
    );
    final url = photoUrl?.trim() ?? '';
    return SizedBox.square(
      dimension: 72,
      child: ClipOval(
        child: url.isEmpty
            ? fallback
            : Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => fallback,
              ),
      ),
    );
  }
}

class _ProfileFailure extends StatelessWidget {
  const _ProfileFailure({
    this.message,
    required this.onRetry,
    this.onSignOut,
  });

  final String? message;
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
            Text(
              message ?? context.l10n.errorProfileLoad,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: Text(context.l10n.commonRetry)),
            if (onSignOut != null)
              TextButton(onPressed: onSignOut, child: Text(context.l10n.commonSignOut)),
          ],
        ),
      ),
    );
  }
}

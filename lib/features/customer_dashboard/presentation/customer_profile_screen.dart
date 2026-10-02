import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/services/image_upload_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
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
  final _phoneController = PhoneController();
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
          phone: _phoneController.value,
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
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ChangePasswordSheet(),
    );
    if (changed == true && mounted) {
      _showMessage(context.l10n.profilePasswordChanged);
    }
  }

  void _showMessage(String message, {bool isError = false}) {
    showAppSnackBar(
      context,
      message,
      tone: isError ? AppTone.error : AppTone.success,
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
            const AppLoadingState(),
            AppButton.text(
              label: context.l10n.commonSignOut,
              icon: Icons.logout,
              onPressed: () =>
                  ref.read(authControllerProvider.notifier).signOut(),
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


/// The change-password form. It owns its text fields' controllers, so they
/// are disposed only once the sheet has finished sliding shut. (Disposing them
/// as soon as the sheet's future completed, at the start of that animation,
/// crashed the screen with "_dependents.isEmpty".)
class _ChangePasswordSheet extends ConsumerStatefulWidget {
  const _ChangePasswordSheet();

  @override
  ConsumerState<_ChangePasswordSheet> createState() =>
      _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends ConsumerState<_ChangePasswordSheet> {
  final _formKey = GlobalKey<FormState>();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  bool _isSubmitting = false;

  /// Why the last attempt was refused, shown inside the sheet (a snack bar
  /// would sit behind it).
  String? _error;

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_isSubmitting || !(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    final error =
        await ref.read(profileControllerProvider.notifier).changePassword(
              currentPassword: _currentPassword.text,
              newPassword: _newPassword.text,
            );
    if (!mounted) {
      return;
    }
    if (error == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _isSubmitting = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.s24,
          AppSpacing.s8,
          AppSpacing.s24,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.s24,
        ),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  l10n.profileChangePassword,
                  style: AppTextStyles.h2,
                ),
                const SizedBox(height: AppSpacing.s20),
                AppTextField(
                  label: l10n.profileCurrentPassword,
                  controller: _currentPassword,
                  password: true,
                  validator: (value) => value == null || value.isEmpty
                      ? l10n.profileCurrentPasswordRequired
                      : null,
                ),
                const SizedBox(height: AppSpacing.s16),
                AppTextField(
                  label: l10n.passwordChangeNew,
                  controller: _newPassword,
                  password: true,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return l10n.passwordChangeNewRequired;
                    }
                    if (value.length < 6) {
                      return l10n.profilePasswordMin;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppSpacing.s16),
                AppTextField(
                  label: l10n.passwordChangeConfirm,
                  controller: _confirmPassword,
                  password: true,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return l10n.profileConfirmPasswordRequired;
                    }
                    if (value != _newPassword.text) {
                      return l10n.authPasswordsMismatch;
                    }
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.s12),
                  Text(
                    _error!,
                    style: AppTextStyles.body
                        .copyWith(color: context.colors.errorText),
                  ),
                ],
                const SizedBox(height: AppSpacing.s24),
                AppButton.primary(
                  label: l10n.profileUpdatePassword,
                  loading: _isSubmitting,
                  expand: true,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
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
  final PhoneController phoneController;
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
    final l10n = context.l10n;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return ListView(
      padding: EdgeInsets.all(margin),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (isEditing)
                  ImagePickerField(
                    controller: photoController,
                    enabled: !isSaving,
                    shape: ImagePickerShape.circle,
                    fallbackIcon: Icons.person_outline,
                  )
                else
                  Center(
                    child: AppAvatar(
                      name: profile.fullName,
                      imageUrl: profile.photoUrl?.trim(),
                      size: 72,
                    ),
                  ),
                const SizedBox(height: AppSpacing.s12),
                Text(
                  l10n.profileMyProfile,
                  textAlign: TextAlign.center,
                  style: AppTextStyles.h1,
                ),
                const SizedBox(height: AppSpacing.s24),
                Form(
                  key: formKey,
                  child: Column(
                    children: [
                      AppTextField(
                        label: l10n.profileFullName,
                        controller: nameController,
                        enabled: isEditing && !isSaving,
                        textCapitalization: TextCapitalization.words,
                        prefixIcon: Icons.person_outline,
                        validator: (value) =>
                            value == null || value.trim().isEmpty
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
                      PhoneField(
                        label: l10n.profilePhoneNumber,
                        optional: true,
                        controller: phoneController,
                        enabled: isEditing && !isSaving,
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
                    label: l10n.profileEdit,
                    icon: Icons.edit_outlined,
                    expand: true,
                    onPressed: onEdit,
                  ),
                const SizedBox(height: AppSpacing.s16),
                AppListCard(
                  onTap: onChangePassword,
                  leading: const AppIconTile(
                    icon: Icons.lock_outline,
                    size: 40,
                  ),
                  content: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.profileChangePassword,
                        style: AppTextStyles.bodyStrong,
                      ),
                      Text(
                        l10n.profileChangePasswordSubtitle,
                        style: AppTextStyles.caption
                            .copyWith(color: context.colors.textSecondary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.s16),
                AppButton.destructiveOutlined(
                  label: l10n.commonSignOut,
                  icon: Icons.logout,
                  expand: true,
                  onPressed: onSignOut,
                ),
              ],
            ),
          ),
        ),
      ],
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppErrorState(
            icon: Icons.person_off_outlined,
            message: message ?? context.l10n.errorProfileLoad,
            onRetry: onRetry,
          ),
          if (onSignOut != null)
            AppButton.text(
              label: context.l10n.commonSignOut,
              onPressed: onSignOut,
            ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/locale_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../settings/presentation/settings_screen.dart';
import 'auth_controller.dart';
import 'password_change_strings.dart';

/// Shown instead of the company-admin workspace while the account is still on
/// the temporary password the Platform Admin set. The company enters that
/// temporary password once more (it re-authenticates the change), chooses its
/// own, and only then does the flag clear and the workspace open.
class ForcePasswordChangeScreen extends ConsumerStatefulWidget {
  const ForcePasswordChangeScreen({super.key});

  @override
  ConsumerState<ForcePasswordChangeScreen> createState() =>
      _ForcePasswordChangeScreenState();
}

class _ForcePasswordChangeScreenState
    extends ConsumerState<ForcePasswordChangeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _isSaving = false;
  String? _error;

  /// The new password is already set in Firebase Authentication but clearing
  /// the flag failed (e.g. the connection dropped). A retry must only redo the
  /// flag, because the temporary password no longer works.
  bool _passwordUpdated = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_isSaving) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _isSaving = true;
      _error = null;
    });
    final controller = ref.read(profileControllerProvider.notifier);

    String? error;
    if (!_passwordUpdated) {
      error = await controller.changePassword(
        currentPassword: _currentController.text,
        newPassword: _newController.text,
      );
      if (error == null) {
        _passwordUpdated = true;
      }
    }
    error ??= await controller.markPasswordChanged();

    if (!mounted) return;
    // On success the profile no longer requires a change, so the router
    // replaces this screen with the company workspace.
    setState(() {
      _isSaving = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final strings = PasswordChangeStrings.of(context);
    // A message is text in one language, so it is dropped when the language
    // changes rather than left behind in the old one.
    ref.listen(localeControllerProvider, (_, _) {
      if (_error != null) setState(() => _error = null);
    });

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Text(strings.title),
        actions: const [SettingsButton()],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(
                      child: AppIconTile(
                        icon: Icons.lock_reset_rounded,
                        size: 72,
                        radius: AppRadius.full,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.s16),
                    Text(
                      strings.intro,
                      textAlign: TextAlign.center,
                      style: AppTextStyles.bodyLarge,
                    ),
                    const SizedBox(height: AppSpacing.s24),
                    if (!_passwordUpdated) ...[
                      AppTextField(
                        label: strings.currentPassword,
                        controller: _currentController,
                        enabled: !_isSaving,
                        password: true,
                        autofillHints: const [AutofillHints.password],
                        prefixIcon: Icons.lock_outline,
                        validator: (value) => (value ?? '').isEmpty
                            ? strings.currentRequired
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.s16),
                      AppTextField(
                        label: strings.newPassword,
                        controller: _newController,
                        enabled: !_isSaving,
                        password: true,
                        autofillHints: const [AutofillHints.newPassword],
                        prefixIcon: Icons.lock_reset_outlined,
                        validator: (value) {
                          final text = value ?? '';
                          if (text.isEmpty) return strings.newRequired;
                          // Keeping the temporary password is allowed, so there
                          // is deliberately no "must differ" check here.
                          if (text.length < PasswordChangeStrings.minLength) {
                            return strings.tooShort;
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: AppSpacing.s16),
                      AppTextField(
                        label: strings.confirmPassword,
                        controller: _confirmController,
                        enabled: !_isSaving,
                        password: true,
                        prefixIcon: Icons.lock_reset_outlined,
                        validator: (value) => value != _newController.text
                            ? strings.mismatch
                            : null,
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: AppSpacing.s16),
                      AppBanner(tone: AppTone.error, message: _error!),
                    ],
                    const SizedBox(height: AppSpacing.s24),
                    AppButton.primary(
                      label: strings.submit,
                      loading: _isSaving,
                      expand: true,
                      onPressed: _submit,
                    ),
                    const SizedBox(height: AppSpacing.s12),
                    AppButton.outlined(
                      label: strings.signOut,
                      icon: Icons.logout,
                      expand: true,
                      onPressed: _isSaving
                          ? null
                          : () =>
                              ref.read(authControllerProvider.notifier).signOut(),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../settings/presentation/language_selector.dart';
import 'auth_controller.dart';
import 'auth_error_messages.dart';
import 'auth_state.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  bool _isSubmitting = false;
  bool _didSubmit = false;

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_isSubmitting) {
      return;
    }
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() {
      _isSubmitting = true;
      _didSubmit = true;
    });
    try {
      await ref.read(authControllerProvider.notifier).signUpWithEmail(
        fullName: _fullNameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      if (!mounted) {
        return;
      }
      if (ref.read(authControllerProvider) is AuthAuthenticated &&
          Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  void _goToLogin() {
    if (_isSubmitting) {
      return;
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final authState = ref.watch(authControllerProvider);
    final errorMessage = _didSubmit && authState is AuthError
        ? authErrorMessage(l10n, authState.code)
        : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.authCreateAccount),
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 32,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Center(child: LanguageSelector()),
                          const SizedBox(height: 24),
                          const Center(child: AppLogo()),
                          const SizedBox(height: 16),
                          Text(
                            l10n.authJoinTitle,
                            textAlign: TextAlign.center,
                            style: AppTextStyles.h1,
                          ),
                          const SizedBox(height: AppSpacing.s8),
                          Text(
                            l10n.authCreateAccountSubtitle,
                            textAlign: TextAlign.center,
                            style: AppTextStyles.bodyLarge
                                .copyWith(color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: AppSpacing.s32),
                          AppTextField(
                            label: l10n.authFullName,
                            controller: _fullNameController,
                            enabled: !_isSubmitting,
                            textInputAction: TextInputAction.next,
                            textCapitalization: TextCapitalization.words,
                            autofillHints: const [AutofillHints.name],
                            prefixIcon: Icons.person_outline,
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return l10n.authFullNameRequired;
                              }
                              final name = value.trim();
                              final nameRegex = RegExp(
                                r"^[؀-ۿݐ-ݿࢠ-ࣿa-zA-Z\s'\-]+$",
                              );
                              if (!nameRegex.hasMatch(name)) {
                                return l10n.authFullNameInvalid;
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: AppSpacing.s16),
                          AppTextField(
                            label: l10n.authEmail,
                            controller: _emailController,
                            enabled: !_isSubmitting,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.email],
                            hint: 'you@example.com',
                            prefixIcon: Icons.email_outlined,
                            validator: (value) {
                              final email = value?.trim() ?? '';
                              if (email.isEmpty) {
                                return l10n.authEmailRequired;
                              }
                              if (!_emailRegex.hasMatch(email)) {
                                return l10n.authEmailInvalid;
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: AppSpacing.s16),
                          AppTextField(
                            label: l10n.authPassword,
                            controller: _passwordController,
                            enabled: !_isSubmitting,
                            password: true,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.newPassword],
                            helperText: l10n.authPasswordHelper,
                            prefixIcon: Icons.lock_outline,
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return l10n.authPasswordRequired;
                              }
                              if (value.length < 6) {
                                return l10n.authPasswordTooShort;
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: AppSpacing.s16),
                          AppTextField(
                            label: l10n.authConfirmPassword,
                            controller: _confirmPasswordController,
                            enabled: !_isSubmitting,
                            password: true,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _submit(),
                            prefixIcon: Icons.lock_outline,
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return l10n.authConfirmPasswordRequired;
                              }
                              if (value != _passwordController.text) {
                                return l10n.authPasswordsMismatch;
                              }
                              return null;
                            },
                          ),
                          if (errorMessage != null) ...[
                            const SizedBox(height: AppSpacing.s16),
                            AppBanner(
                              tone: AppTone.error,
                              message: errorMessage,
                            ),
                          ],
                          const SizedBox(height: AppSpacing.s24),
                          AppButton.primary(
                            label: l10n.authRegister,
                            loading: _isSubmitting,
                            expand: true,
                            onPressed: _submit,
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            alignment: WrapAlignment.center,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                l10n.authHaveAccount,
                                style: AppTextStyles.body,
                              ),
                              TextButton(
                                onPressed: _isSubmitting ? null : _goToLogin,
                                child: Text(l10n.authLogin),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

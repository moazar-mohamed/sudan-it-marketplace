import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../domain/exceptions/auth_exception.dart';
import 'auth_error_messages.dart';
import 'auth_providers.dart';

/// Password reset by e-mail, for every role that signs in with the shared login
/// screen (customer, company admin, technician).
///
/// It talks to the auth repository directly and never touches the app-wide
/// auth state: `AuthGate` swaps the whole screen on `AuthLoading`/`AuthError`,
/// which would throw this form away mid-request.
///
/// The result never tells whether an account exists for the address: an
/// unknown address shows the same "if an account exists" message as a known
/// one, so the form cannot be used to discover who is registered.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    this.initialEmail = '',
    this.resendCooldown = const Duration(seconds: 60),
  });

  /// Pre-filled from the login form.
  final String initialEmail;

  /// How long "Resend" stays unavailable after a send.
  final Duration resendCooldown;

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  static final _emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  final _formKey = GlobalKey<FormState>();
  late final _emailController = TextEditingController(text: widget.initialEmail);

  bool _sending = false;
  String? _sentTo;
  String? _errorCode;
  int _secondsLeft = 0;
  Timer? _ticker;

  @override
  void dispose() {
    _ticker?.cancel();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_sending || _secondsLeft > 0) return;
    FocusScope.of(context).unfocus();
    // After the first send the form is gone and the address is already known.
    final resending = _sentTo != null;
    if (!resending && !(_formKey.currentState?.validate() ?? false)) return;

    final email = resending ? _sentTo! : _emailController.text.trim();
    final languageCode = Localizations.localeOf(context).languageCode;
    setState(() {
      _sending = true;
      _errorCode = null;
    });
    String? failure;
    try {
      await ref.read(authRepositoryProvider).sendPasswordResetEmail(
            email: email,
            languageCode: languageCode,
          );
    } on AuthException catch (error) {
      // No account for this address is reported like a success (see above).
      if (error.code != 'user-not-found') failure = error.code ?? 'unknown';
    } catch (_) {
      failure = 'unknown';
    }
    if (!mounted) return;
    setState(() {
      _sending = false;
      _errorCode = failure;
      if (failure == null) _sentTo = email;
    });
    if (failure == null) _startCooldown();
  }

  void _startCooldown() {
    _ticker?.cancel();
    _secondsLeft = widget.resendCooldown.inSeconds;
    if (_secondsLeft <= 0) return;
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) timer.cancel();
    });
  }

  @override
  Widget build(BuildContext context) {
    final sent = _sentTo != null;

    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.s24,
            vertical: AppSpacing.s24,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: sent ? _buildSent(context) : _buildForm(context),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    final l10n = context.l10n;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Center(
            child: AppIconTile(
              icon: Icons.lock_reset_rounded,
              tone: AppTone.brand,
              size: 72,
              radius: AppRadius.full,
              iconSize: AppSize.iconXl,
            ),
          ),
          const SizedBox(height: AppSpacing.s16),
          Text(
            l10n.authForgotPasswordTitle,
            textAlign: TextAlign.center,
            style: AppTextStyles.h2,
          ),
          const SizedBox(height: AppSpacing.s8),
          Text(
            l10n.authForgotPasswordBody,
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.s24),
          AppTextField(
            label: l10n.authEmail,
            controller: _emailController,
            enabled: !_sending,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            hint: 'you@example.com',
            prefixIcon: Icons.email_outlined,
            textDirection: TextDirection.ltr,
            onFieldSubmitted: (_) => _send(),
            validator: (value) {
              final email = value?.trim() ?? '';
              if (email.isEmpty) return l10n.authEmailRequired;
              if (!_emailRegex.hasMatch(email)) return l10n.authEmailInvalid;
              return null;
            },
          ),
          if (_errorCode != null) ...[
            const SizedBox(height: AppSpacing.s16),
            AppBanner(
              tone: AppTone.error,
              message: passwordResetErrorMessage(l10n, _errorCode),
            ),
          ],
          const SizedBox(height: AppSpacing.s24),
          AppButton.primary(
            label: l10n.authForgotPasswordSend,
            loading: _sending,
            expand: true,
            onPressed: _send,
          ),
        ],
      ),
    );
  }

  Widget _buildSent(BuildContext context) {
    final l10n = context.l10n;
    final waiting = _secondsLeft > 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(
          child: AppIconTile(
            icon: Icons.mark_email_read_outlined,
            tone: AppTone.success,
            size: 72,
            radius: AppRadius.full,
            iconSize: AppSize.iconXl,
          ),
        ),
        const SizedBox(height: AppSpacing.s16),
        Text(
          l10n.authForgotPasswordSentTitle,
          textAlign: TextAlign.center,
          style: AppTextStyles.h2,
        ),
        const SizedBox(height: AppSpacing.s8),
        Text(
          l10n.authForgotPasswordSentBody(_sentTo!),
          textAlign: TextAlign.center,
          style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
        ),
        if (_errorCode != null) ...[
          const SizedBox(height: AppSpacing.s16),
          AppBanner(
            tone: AppTone.error,
            message: passwordResetErrorMessage(l10n, _errorCode),
          ),
        ],
        const SizedBox(height: AppSpacing.s24),
        AppButton.primary(
          label: l10n.authForgotPasswordBackToLogin,
          expand: true,
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        const SizedBox(height: AppSpacing.s12),
        AppButton.outlined(
          label: waiting
              ? l10n.authForgotPasswordResendIn(_secondsLeft)
              : l10n.authForgotPasswordResend,
          loading: _sending,
          expand: true,
          onPressed: waiting ? null : _send,
        ),
      ],
    );
  }
}

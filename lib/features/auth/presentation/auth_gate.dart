import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../company_admin/presentation/company_admin_shell.dart';
import '../../customer_dashboard/presentation/customer_dashboard_screen.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../technician/presentation/technician_shell.dart';
import '../../technicians/domain/entities/technician.dart';
import '../../technicians/presentation/technicians_providers.dart';
import '../domain/entities/user_role.dart';
import 'auth_controller.dart';
import 'auth_state.dart';
import 'force_password_change_screen.dart';
import 'login_screen.dart';

class AuthGate extends ConsumerWidget {
  /// [customerInitialTab] is the dashboard tab a signed-in customer starts on
  /// (0 Home, 1 Orders, 2 Profile). Screens that return the customer to the app
  /// go through the gate, so a later sign-out always lands on the login screen.
  const AuthGate({super.key, this.customerInitialTab = 0});

  final int customerInitialTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);

    return switch (authState) {
      AuthLoading() => const _SessionLoadingScreen(),
      AuthAuthenticated() => _RoleRouter(customerInitialTab: customerInitialTab),
      AuthUnauthenticated() || AuthError() => const LoginScreen(),
    };
  }
}

/// Sends a signed-in user to the experience that matches their stored role.
class _RoleRouter extends ConsumerWidget {
  const _RoleRouter({this.customerInitialTab = 0});

  final int customerInitialTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    // The Firestore rule that authorizes a technician's self-lookup checks
    // request.auth.token.email (the live Firebase Auth email), so the query
    // must use that same value rather than the users/{uid} profile
    // document's email field, which can drift out of sync with it.
    final authUser = switch (authState) {
      AuthAuthenticated(:final user) => user,
      _ => null,
    };
    final authEmail = authUser?.email ?? '';
    // Google (and other trusted OAuth) accounts come back from Firebase
    // already verified, so this only ever blocks email/password customers.
    Widget customerEntry() {
      if (authUser != null && !authUser.emailVerified) {
        return _EmailVerificationRequiredScreen(email: authUser.email ?? '');
      }
      return CustomerDashboardScreen(initialTabIndex: customerInitialTab);
    }

    final profileAsync = ref.watch(profileControllerProvider);

    return profileAsync.when(
      skipLoadingOnReload: true,
      loading: () => const _SessionLoadingScreen(),
      // Keep the existing behaviour for customers: the customer dashboard
      // surfaces its own profile error and retry.
      error: (_, _) => customerEntry(),
      data: (profile) {
        if (profile == null) {
          return customerEntry();
        }
        // ignore: avoid_print
        print('[DIAG][RoleRouter] role=${profile.role} '
            'companyId=${profile.companyId} authEmail=$authEmail');
        return switch (profile.role) {
          // A customer deactivated by the platform admin keeps their account
          // and history but cannot use the app until reactivated.
          UserRole.customer => profile.isActive
              ? customerEntry()
              : const _AccessMessageScreen(
                  title: 'Account deactivated',
                  message:
                      'Your account has been deactivated. Please contact support to have it reactivated.',
                ),
          // A company admin still on the temporary password set by the
          // Platform Admin must choose their own before anything else.
          UserRole.companyAdmin when profile.requiresPasswordChange =>
            const ForcePasswordChangeScreen(),
          UserRole.companyAdmin =>
            (profile.companyId == null || profile.companyId!.isEmpty)
                ? const _AccessMessageScreen(
                    title: 'Company not linked',
                    message:
                        'Your company admin account is not linked to a company yet. Please contact the platform administrator.',
                  )
                : CompanyAdminShell(companyId: profile.companyId!),
          UserRole.platformAdmin => const _AccessMessageScreen(
              title: 'Platform Admin',
              message:
                  'Platform administration is managed separately and is not available in this app.',
            ),
          UserRole.technician =>
            (profile.companyId == null || profile.companyId!.isEmpty)
                ? const _AccessMessageScreen(
                    title: 'Company not linked',
                    message:
                        'Your technician account is not linked to a company yet. Please contact your company administrator.',
                  )
                // Technicians self-register through the same email/password
                // flow as customers, so they go through the same
                // verification gate before entering their workspace.
                : (authUser != null && !authUser.emailVerified)
                    ? _EmailVerificationRequiredScreen(
                        email: authUser.email ?? '',
                      )
                    : _TechnicianRoleRouter(
                        uid: profile.id,
                        companyId: profile.companyId!,
                        email: authEmail,
                      ),
        };
      },
    );
  }
}

/// Resolves the signed-in technician's own technician record before
/// entering the Technician experience. Technicians created through the
/// invite/claim flow have a `technicians/{uid}` document keyed by their own
/// Firebase Auth uid; technicians created before self-registration existed
/// are matched by company + email instead.
class _TechnicianRoleRouter extends ConsumerWidget {
  const _TechnicianRoleRouter({
    required this.uid,
    required this.companyId,
    required this.email,
  });

  final String uid;
  final String companyId;
  final String email;

  Widget _fromTechnician(Technician? technician) {
    if (technician == null) {
      return const _AccessMessageScreen(
        title: 'Technician account',
        message:
            'Your technician account is not yet set up. Please contact your company administrator.',
      );
    }
    if (!technician.isActive) {
      return const _AccessMessageScreen(
        title: 'Technician account',
        message:
            'Your technician account has been deactivated. Please contact your company administrator.',
      );
    }
    return TechnicianShell(
      companyId: technician.companyId,
      technicianId: technician.id,
      technicianName: technician.fullName,
      technicianPhone: technician.phone,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final byUidAsync = ref.watch(technicianByUidProvider(uid));

    return byUidAsync.when(
      loading: () => const _SessionLoadingScreen(),
      error: (_, _) => const _AccessMessageScreen(
        title: 'Technician account',
        message:
            'Could not load your technician record. Please try again or contact your company administrator.',
      ),
      data: (technicianByUid) {
        if (technicianByUid != null) {
          return _fromTechnician(technicianByUid);
        }
        final fallbackAsync = ref.watch(
          technicianSelfProvider((companyId: companyId, email: email)),
        );
        return fallbackAsync.when(
          loading: () => const _SessionLoadingScreen(),
          error: (_, _) => const _AccessMessageScreen(
            title: 'Technician account',
            message:
                'Could not load your technician record. Please try again or contact your company administrator.',
          ),
          data: _fromTechnician,
        );
      },
    );
  }
}

class _AccessMessageScreen extends ConsumerWidget {
  const _AccessMessageScreen({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  size: 56,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge,
                ),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: () =>
                      ref.read(authControllerProvider.notifier).signOut(),
                  icon: const Icon(Icons.logout),
                  label: const Text('Sign out'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Blocks a signed-in but unverified email/password customer from entering
/// the app, with actions to resend the verification email or re-check
/// Firebase's verification state.
class _EmailVerificationRequiredScreen extends ConsumerStatefulWidget {
  const _EmailVerificationRequiredScreen({required this.email});

  final String email;

  @override
  ConsumerState<_EmailVerificationRequiredScreen> createState() =>
      _EmailVerificationRequiredScreenState();
}

class _EmailVerificationRequiredScreenState
    extends ConsumerState<_EmailVerificationRequiredScreen> {
  bool _isResending = false;
  bool _isChecking = false;

  Future<void> _resend() async {
    if (_isResending) return;
    setState(() => _isResending = true);
    final error =
        await ref.read(authControllerProvider.notifier).resendVerificationEmail();
    if (!mounted) return;
    setState(() => _isResending = false);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            error ?? 'Verification email sent. Please check your inbox.',
          ),
        ),
      );
  }

  Future<void> _checkAgain() async {
    if (_isChecking) return;
    setState(() => _isChecking = true);
    final verified =
        await ref.read(authControllerProvider.notifier).refreshEmailVerification();
    if (!mounted) return;
    setState(() => _isChecking = false);
    if (!verified) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              "Still not verified. Please tap the link in the email, then try again.",
            ),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Verify your email')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.mark_email_unread_outlined,
                  size: 56,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  widget.email.isEmpty
                      ? 'Please verify your email address before continuing.'
                      : 'We sent a verification link to ${widget.email}. '
                          'Please verify your email before continuing.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _isChecking ? null : _checkAgain,
                  icon: _isChecking
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      : const Icon(Icons.refresh),
                  label: const Text("I've verified my email"),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _isResending ? null : _resend,
                  icon: _isResending
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      : const Icon(Icons.mail_outline),
                  label: const Text('Resend verification email'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () =>
                      ref.read(authControllerProvider.notifier).signOut(),
                  icon: const Icon(Icons.logout),
                  label: const Text('Sign out'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SessionLoadingScreen extends StatelessWidget {
  const _SessionLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../company_admin/presentation/company_admin_shell.dart';
import '../../customer_dashboard/presentation/customer_dashboard_screen.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../technician/presentation/technician_shell.dart';
import '../../technicians/presentation/technicians_providers.dart';
import '../domain/entities/user_role.dart';
import 'auth_controller.dart';
import 'auth_state.dart';
import 'login_screen.dart';

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);

    return switch (authState) {
      AuthLoading() => const _SessionLoadingScreen(),
      AuthAuthenticated() => const _RoleRouter(),
      AuthUnauthenticated() || AuthError() => const LoginScreen(),
    };
  }
}

/// Sends a signed-in user to the experience that matches their stored role.
class _RoleRouter extends ConsumerWidget {
  const _RoleRouter();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileControllerProvider);

    return profileAsync.when(
      skipLoadingOnReload: true,
      loading: () => const _SessionLoadingScreen(),
      // Keep the existing behaviour for customers: the customer dashboard
      // surfaces its own profile error and retry.
      error: (_, __) => const CustomerDashboardScreen(),
      data: (profile) {
        if (profile == null) {
          return const CustomerDashboardScreen();
        }
        return switch (profile.role) {
          UserRole.customer => const CustomerDashboardScreen(),
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
                : _TechnicianRoleRouter(
                    companyId: profile.companyId!,
                    email: profile.email,
                  ),
        };
      },
    );
  }
}

/// Resolves the signed-in technician's own `technicians/{id}` record (by
/// company + email, since technician accounts are provisioned outside the
/// app the same way company_admin accounts are) before entering the
/// Technician experience.
class _TechnicianRoleRouter extends ConsumerWidget {
  const _TechnicianRoleRouter({required this.companyId, required this.email});

  final String companyId;
  final String email;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final technicianAsync = ref.watch(
      technicianSelfProvider((companyId: companyId, email: email)),
    );

    return technicianAsync.when(
      loading: () => const _SessionLoadingScreen(),
      error: (_, __) => const _AccessMessageScreen(
        title: 'Technician account',
        message:
            'Could not load your technician record. Please try again or contact your company administrator.',
      ),
      data: (technician) {
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

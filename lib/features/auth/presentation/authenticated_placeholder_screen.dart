import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../domain/entities/auth_user.dart';
import 'auth_controller.dart';

class AuthenticatedPlaceholderScreen extends ConsumerWidget {
  const AuthenticatedPlaceholderScreen({super.key, required this.user});

  final AuthUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.appName),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.verified_user_outlined,
                  size: 56,
                  color: colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  context.l10n.authSignedInTitle,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  user.email ?? user.id,
                  style: theme.textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  context.l10n.authDashboardLater,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurface.withValues(alpha: 0.7),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: () {
                    ref.read(authControllerProvider.notifier).signOut();
                  },
                  child: Text(context.l10n.commonSignOut),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

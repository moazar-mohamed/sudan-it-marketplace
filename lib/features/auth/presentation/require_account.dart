import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../chats/presentation/chat_providers.dart';
import 'auth_controller.dart';
import 'auth_state.dart';
import 'login_screen.dart';

/// Whether someone is signed in right now.
bool isSignedIn(WidgetRef ref) {
  // The signed-in user's id, as every account page reads it. Without
  // Firebase (a test) nobody is signed in.
  try {
    final id = ref.read(currentUserIdProvider);
    return id != null && id.isNotEmpty;
  } catch (_) {
    return false;
  }
}

/// Opens the sign-in screen over the page the visitor is on, as the site's
/// «تسجيل الدخول» with `?next=`: once signed in (or registered) every sign-in
/// page closes and the visitor is back on that same page, now with an account.
Future<void> openSignIn(BuildContext context) {
  final navigator = Navigator.of(context);
  final returnTo = ModalRoute.of(context);
  return navigator.push(
    MaterialPageRoute<void>(
      builder: (_) => _SignInPage(
        onSignedIn: () =>
            navigator.popUntil((route) => route == returnTo || route.isFirst),
      ),
    ),
  );
}

/// For an action that needs an account (a heart, Buy now, Contact, a
/// request): true when signed in; otherwise opens sign-in and returns false,
/// so the visitor presses the action again once back.
bool requireAccount(BuildContext context, WidgetRef ref) {
  if (isSignedIn(ref)) return true;
  openSignIn(context);
  return false;
}

class _SignInPage extends ConsumerWidget {
  const _SignInPage({required this.onSignedIn});

  final VoidCallback onSignedIn;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authControllerProvider, (_, next) {
      if (next is AuthAuthenticated) onSignedIn();
    });
    return Scaffold(appBar: AppBar(), body: const LoginScreen());
  }
}

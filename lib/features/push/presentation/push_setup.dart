import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/logging/debug_log.dart';
import '../../../core/navigation/app_keys.dart';
import '../../../core/push/push_relay.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../auth/domain/entities/user_profile.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_state.dart';
import '../../chats/presentation/chat_screen.dart';
import '../../company_admin/presentation/orders/company_order_details_screen.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../orders/presentation/order_details_screen.dart';
import '../../orders/presentation/orders_providers.dart';
import '../../service_requests/presentation/service_request_details_screen.dart';
import '../data/push_tokens.dart';
import 'push_destination.dart';
import 'push_preference.dart';

/// Phone push notifications, watched once from the root widget:
///
/// * once someone is signed in, this phone is registered to receive their
///   pushes (asking for permission the first time), unless the user turned
///   the phone's notifications off in Settings ([pushEnabledProvider]);
/// * on sign-out the phone's registration is dropped, so a shared phone
///   stops receiving the previous user's pushes;
/// * a push that arrives while the app is open shows as a short banner;
/// * tapping a push (or its banner) opens the order or conversation.
///
/// Does nothing on the web or while the push relay is not configured.
final pushSetupProvider = Provider<void>((ref) {
  if (kIsWeb || !ref.watch(pushRelayProvider).isEnabled) return;

  final messaging = FirebaseMessaging.instance;
  final tokens = FirestorePushTokens();
  String? signedInUid;
  StreamSubscription<String>? tokenRefresh;
  var checkedLaunchPush = false;

  Future<void> register(String uid) async {
    if (ref.read(pushEnabledProvider)) {
      try {
        final settings = await messaging.requestPermission();
        final blocked =
            settings.authorizationStatus == AuthorizationStatus.denied;
        ref.read(pushBlockedProvider.notifier).set(blocked);
        if (!blocked) {
          final token = await messaging.getToken();
          if (token != null &&
              signedInUid == uid &&
              ref.read(pushEnabledProvider)) {
            await tokens.register(uid, token);
          }
          tokenRefresh ??= messaging.onTokenRefresh.listen((fresh) {
            final current = signedInUid;
            if (current != null && ref.read(pushEnabledProvider)) {
              tokens.register(current, fresh).catchError(
                    (Object error) => debugLog('Push', 'token refresh: $error'),
                  );
            }
          });
        }
      } catch (error) {
        debugLog('Push', 'could not register this phone: $error');
      }
    }
    // The app was started by tapping a push: open what it was about.
    if (!checkedLaunchPush) {
      checkedLaunchPush = true;
      final launch = await messaging.getInitialMessage();
      if (launch != null) _open(ref, launch.data);
    }
  }

  /// The switch was turned off: this phone stops receiving [uid]'s pushes
  /// at once, instead of waiting for the relay to find its address dead.
  Future<void> unregister(String uid) async {
    try {
      final token = await messaging.getToken();
      if (token != null) await tokens.unregister(uid, token);
      await messaging.deleteToken();
    } catch (error) {
      debugLog('Push', 'could not stop pushes on this phone: $error');
    }
    ref.read(pushBlockedProvider.notifier).set(false);
  }

  ref.listen<AsyncValue<UserProfile?>>(profileControllerProvider, (_, next) {
    final profile = next.asData?.value;
    if (profile != null) {
      if (signedInUid == profile.id) return;
      signedInUid = profile.id;
      register(profile.id);
      return;
    }
    if (signedInUid != null &&
        ref.read(authControllerProvider) is! AuthAuthenticated) {
      signedInUid = null;
      // FCM forgets this phone's address; the relay then drops it from the
      // previous user's profile the next time it tries it.
      messaging.deleteToken().catchError(
            (Object error) => debugLog('Push', 'token delete: $error'),
          );
    }
  }, fireImmediately: true);

  ref.listen<bool>(pushEnabledProvider, (_, enabled) {
    final uid = signedInUid;
    if (uid == null) return;
    if (enabled) {
      register(uid);
    } else {
      unregister(uid);
    }
  });

  final subscriptions = [
    FirebaseMessaging.onMessage.listen((message) => _showBanner(ref, message)),
    FirebaseMessaging.onMessageOpenedApp
        .listen((message) => _open(ref, message.data)),
  ];
  ref.onDispose(() {
    for (final subscription in subscriptions) {
      subscription.cancel();
    }
    tokenRefresh?.cancel();
  });
});

PushDestination? _destinationFor(Ref ref, Map<String, dynamic> data) {
  final profile = ref.read(profileControllerProvider).asData?.value;
  return profile == null ? null : pushDestination(data, profile);
}

void _open(Ref ref, Map<String, dynamic> data) {
  final destination = _destinationFor(ref, data);
  final navigator = appNavigatorKey.currentState;
  if (destination == null || navigator == null) return;
  navigator.push(
    MaterialPageRoute<void>(builder: (_) => pushDestinationScreen(destination)),
  );
}

/// The screen for [destination].
Widget pushDestinationScreen(PushDestination destination) {
  return switch (destination) {
    ChatDestination(:final chatId, :final role) =>
      ChatScreen(chatId: chatId, role: role),
    CompanyOrderDestination(:final companyId, :final orderId) =>
      CompanyOrderDetailsScreen(companyId: companyId, orderId: orderId),
    CustomerOrderDestination(:final orderId) =>
      _CustomerOrderLoader(orderId: orderId),
    ServiceRequestDestination(:final requestId, :final asCompany) =>
      ServiceRequestDetailsScreen(requestId: requestId, asCompany: asCompany),
  };
}

/// While the app is open the system shows nothing for a push, so it becomes
/// a banner, unless it is a message of the conversation already on screen.
void _showBanner(Ref ref, RemoteMessage message) {
  final notification = message.notification;
  final messenger = appScaffoldMessengerKey.currentState;
  if (notification == null || messenger == null) return;
  final chatId = message.data['chatId'] as String?;
  if (chatId != null && ChatScreen.isOnScreen(chatId)) return;
  final destination = _destinationFor(ref, message.data);
  final l10n = ref.read(appLocalizationsProvider);
  messenger.showSnackBar(
    SnackBar(
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 6),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if ((notification.title ?? '').isNotEmpty)
            Text(
              notification.title!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              // The snack bar's own text colour (it flips with dark mode).
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          if ((notification.body ?? '').isNotEmpty)
            Text(
              notification.body!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
        ],
      ),
      action: destination == null
          ? null
          : SnackBarAction(
              label: l10n.pushOpen,
              onPressed: () => appNavigatorKey.currentState?.push(
                MaterialPageRoute<void>(
                  builder: (_) => pushDestinationScreen(destination),
                ),
              ),
            ),
    ),
  );
}

/// A customer's order opened from a push (only its id is known).
class _CustomerOrderLoader extends ConsumerWidget {
  const _CustomerOrderLoader({required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(orderStreamProvider(orderId));
    final order = orderAsync.asData?.value;
    if (order != null) return OrderDetailsScreen(order: order);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.orderViewDetails)),
      body: orderAsync.isLoading
          ? const AppLoadingState()
          : AppErrorState(
              message: context.l10n.ordersLoadFailed,
              onRetry: () => ref.invalidate(orderStreamProvider(orderId)),
            ),
    );
  }
}

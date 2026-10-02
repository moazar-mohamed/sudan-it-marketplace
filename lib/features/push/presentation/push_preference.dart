import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/locale_controller.dart';

/// Where the "phone notifications" switch is remembered on this phone.
const pushEnabledPreferenceKey = 'push_enabled';

/// Whether this phone receives pushes. A choice about the phone, not the
/// account: it stays when another account signs in, and it is on by default.
final pushEnabledProvider =
    NotifierProvider<PushEnabledController, bool>(PushEnabledController.new);

class PushEnabledController extends Notifier<bool> {
  @override
  bool build() =>
      ref.read(sharedPreferencesProvider)?.getBool(pushEnabledPreferenceKey) ??
      true;

  Future<void> setEnabled(bool enabled) async {
    if (state != enabled) state = enabled;
    await ref
        .read(sharedPreferencesProvider)
        ?.setBool(pushEnabledPreferenceKey, enabled);
  }
}

/// True while the phone's own settings block this app's notifications, so
/// the switch can say why nothing arrives. Set by the push setup.
final pushBlockedProvider =
    NotifierProvider<PushBlockedController, bool>(PushBlockedController.new);

class PushBlockedController extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool blocked) => state = blocked;
}

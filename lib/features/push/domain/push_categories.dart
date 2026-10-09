import '../../auth/domain/entities/user_role.dart';

/// The kinds of phone notification a person can switch off one by one. The
/// choice is kept on their profile (`users/{uid}.pushPrefs`, one yes/no per
/// kind) and the push relay reads it before it sends, so it applies to every
/// phone of the account. It only mutes the phone: the notification list inside
/// the app always shows everything.
///
/// Keep the names in step with firestore.rules (`isOwnPushPrefsUpdate`) and the
/// push relay (`CATEGORY_OF_TYPE` in push_relay/src/texts.js).
enum PushCategory {
  orders,
  chat,
  serviceRequests,
  reports,

  /// Messages from the platform itself (a product it hid or showed again).
  platform,

  /// "A company now serves your city" (a customer only; a topic push).
  cityAnnouncements;

  /// The key in `pushPrefs`.
  String get key => name;

  /// The kinds a [role] can receive, in the order Settings lists them.
  static List<PushCategory> forRole(UserRole role) => switch (role) {
        UserRole.customer => const [
            orders,
            chat,
            serviceRequests,
            reports,
            cityAnnouncements,
          ],
        UserRole.companyAdmin => const [
            orders,
            chat,
            serviceRequests,
            reports,
            platform,
          ],
        UserRole.technician => const [orders],
        UserRole.platformAdmin => const [],
      };
}

/// Which kinds of push a person switched off. Everything is on until then.
class PushPrefs {
  const PushPrefs([this._off = const {}]);

  /// From the stored map (`{orders: false, ...}`); anything else counts as on.
  factory PushPrefs.fromMap(Object? stored) {
    if (stored is! Map) return const PushPrefs();
    final off = <String>{
      for (final entry in stored.entries)
        if (entry.key is String && entry.value == false) entry.key as String,
    };
    return PushPrefs(off);
  }

  final Set<String> _off;

  bool isOn(PushCategory category) => !_off.contains(category.key);

  /// The map to store: only the kinds that are off are written as `false`, the
  /// ones that are on are written as `true` (so a change is always explicit).
  Map<String, bool> toMap() => {
        for (final category in PushCategory.values)
          category.key: !_off.contains(category.key),
      };

  PushPrefs withKind(PushCategory category, {required bool enabled}) {
    final next = {..._off};
    if (enabled) {
      next.remove(category.key);
    } else {
      next.add(category.key);
    }
    return PushPrefs(next);
  }

  @override
  bool operator ==(Object other) =>
      other is PushPrefs &&
      other._off.length == _off.length &&
      other._off.containsAll(_off);

  @override
  int get hashCode => Object.hashAllUnordered(_off);
}

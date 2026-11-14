import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/entities/user_role.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../data/city_announcer.dart';
import '../data/city_preference_service.dart';
import '../domain/sudan_city.dart';

/// The cities Platform Admin keeps in `platform_settings/cities`, live. The
/// app works from the built-in list until the document exists or while it
/// cannot be read. Watching this provider is what keeps the list current, so
/// every screen that shows or picks a city watches it.
final citiesProvider = StreamProvider<List<SudanCity>>((ref) {
  final Stream<DocumentSnapshot<Map<String, dynamic>>> snapshots;
  try {
    snapshots = FirebaseFirestore.instance
        .collection('platform_settings')
        .doc('cities')
        .snapshots();
  } catch (_) {
    // No Firebase (a test): the list the app ships with.
    return Stream.value(sudanCities);
  }
  return snapshots.map((snapshot) {
    final cities = citiesFromDocument(snapshot.data());
    setCityDirectory(cities);
    return cities;
  }).handleError((Object _) {});
});

/// Tells customers when a company starts serving their city.
final cityAnnouncerProvider = Provider<CityAnnouncer>(
  (ref) => CityAnnouncer.live(),
);

final cityPreferenceServiceProvider = Provider<CityPreferenceService>(
  (ref) => CityPreferenceService(),
);

/// The city the signed-in customer shops in, or null when they have not chosen
/// one yet (or the signed-in user is not a customer). Marketplace lists show
/// only companies that serve this city.
final customerCityIdProvider = Provider<String?>((ref) {
  final profile = ref.watch(profileControllerProvider).asData?.value;
  if (profile == null || profile.role != UserRole.customer) {
    return null;
  }
  return profile.cityId;
});

/// The city the customer is ordering for when it is not their own: they chose
/// another city for a delivery (a gift, a family member). Null means their own
/// city. Kept in memory only, and cleared once an order is placed or their own
/// city changes, so a later order never goes to a forgotten city.
class DeliveryCityOverride extends Notifier<String?> {
  @override
  String? build() => null;

  void set(String? value) => state = value;
}

final deliveryCityOverrideProvider =
    NotifierProvider<DeliveryCityOverride, String?>(DeliveryCityOverride.new);

/// The city an order or service request goes to: the one the customer chose
/// for it, else their own city (null while they have none).
final deliveryCityIdProvider = Provider<String?>((ref) {
  return ref.watch(deliveryCityOverrideProvider) ??
      ref.watch(customerCityIdProvider);
});

/// The city the marketplace lists are ranked by: the customer's own city (null
/// while they have none). Companies that serve it come first; the others stay
/// in the list, after them.
final cityFilterProvider = Provider<String?>((ref) {
  return ref.watch(customerCityIdProvider);
});

/// True once a customer's profile has loaded and it names no city: the app
/// then asks for one before showing the marketplace.
final customerNeedsCityProvider = Provider<bool>((ref) {
  final profile = ref.watch(profileControllerProvider).asData?.value;
  return profile != null &&
      profile.role == UserRole.customer &&
      profile.cityId == null;
});

/// Saves [cityId] on the customer's profile. Returns true on success.
Future<bool> saveCustomerCity(WidgetRef ref, String cityId) async {
  final profile = ref.read(profileControllerProvider).asData?.value;
  if (profile == null) {
    return false;
  }
  try {
    ref.read(deliveryCityOverrideProvider.notifier).set(null);
    await ref
        .read(cityPreferenceServiceProvider)
        .saveCity(userId: profile.id, cityId: cityId);
    ref.read(profileControllerProvider.notifier).applyCity(cityId);
    return true;
  } catch (_) {
    return false;
  }
}

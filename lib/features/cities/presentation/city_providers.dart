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

/// True while the customer chose to look at every city. They can browse all
/// companies, but ordering still needs a company that serves their own city.
/// Kept in memory only: the next launch starts on their own city again.
class BrowseAllCities extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool value) => state = value;
}

final browseAllCitiesProvider =
    NotifierProvider<BrowseAllCities, bool>(BrowseAllCities.new);

/// The city the marketplace lists are narrowed to: the customer's own city, or
/// null (everything) while they browse all cities or have none yet.
final cityFilterProvider = Provider<String?>((ref) {
  if (ref.watch(browseAllCitiesProvider)) {
    return null;
  }
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
    ref.read(browseAllCitiesProvider.notifier).set(false);
    await ref
        .read(cityPreferenceServiceProvider)
        .saveCity(userId: profile.id, cityId: cityId);
    ref.read(profileControllerProvider.notifier).applyCity(cityId);
    return true;
  } catch (_) {
    return false;
  }
}

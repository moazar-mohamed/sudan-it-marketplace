import 'dart:math' as math;

/// A city customers and companies choose from. The [id] is what Firestore
/// stores (`users/{uid}.cityId` and `companies/{id}.serviceCityIds`), so an id
/// never changes once it exists. Platform Admin keeps the list in
/// `platform_settings/cities`; until it has saved one, [builtInCities] is the
/// list. A city is hidden ([active] false), never deleted.
class SudanCity {
  const SudanCity(
    this.id,
    this.nameAr,
    this.nameEn, [
    this.latitude,
    this.longitude,
    this.active = true,
  ]);

  final String id;
  final String nameAr;
  final String nameEn;

  /// The centre of the city, used only to suggest the nearest one. Null for a
  /// city added without a position: it is never suggested.
  final double? latitude;
  final double? longitude;

  /// False once Platform Admin hid the city: it can no longer be chosen, but
  /// customers and companies that already have it keep working.
  final bool active;

  String name(String languageCode) => languageCode == 'ar' ? nameAr : nameEn;

  /// One city of `platform_settings/cities.items`, or null when it is not a
  /// usable entry (no id or no name).
  static SudanCity? tryFromMap(Object? raw) {
    if (raw is! Map) return null;
    final id = raw['id'];
    final nameAr = raw['nameAr'];
    final nameEn = raw['nameEn'];
    if (id is! String || id.isEmpty) return null;
    final ar = nameAr is String ? nameAr.trim() : '';
    final en = nameEn is String ? nameEn.trim() : '';
    if (ar.isEmpty && en.isEmpty) return null;
    double? number(Object? value) => value is num && value.isFinite ? value.toDouble() : null;
    final latitude = number(raw['latitude']);
    final longitude = number(raw['longitude']);
    final hasPoint = latitude != null && longitude != null;
    return SudanCity(
      id,
      ar.isEmpty ? en : ar,
      en.isEmpty ? ar : en,
      hasPoint ? latitude : null,
      hasPoint ? longitude : null,
      raw['active'] != false,
    );
  }
}

const builtInCities = <SudanCity>[
  SudanCity('khartoum', 'الخرطوم', 'Khartoum', 15.5007, 32.5599),
  SudanCity('omdurman', 'أم درمان', 'Omdurman', 15.6445, 32.4777),
  SudanCity('bahri', 'الخرطوم بحري', 'Khartoum Bahri', 15.6389, 32.5444),
  SudanCity('port_sudan', 'بورتسودان', 'Port Sudan', 19.6158, 37.2164),
  SudanCity('wad_madani', 'ود مدني', 'Wad Madani', 14.4012, 33.5199),
  SudanCity('kassala', 'كسلا', 'Kassala', 15.451, 36.404),
  SudanCity('gedaref', 'القضارف', 'Gedaref', 14.035, 35.384),
  SudanCity('atbara', 'عطبرة', 'Atbara', 17.702, 33.986),
  SudanCity('shendi', 'شندي', 'Shendi', 16.687, 33.435),
  SudanCity('ed_damer', 'الدامر', 'Ed Damer', 17.59, 33.96),
  SudanCity('berber', 'بربر', 'Berber', 18.017, 33.983),
  SudanCity('dongola', 'دنقلا', 'Dongola', 19.165, 30.476),
  SudanCity('wadi_halfa', 'وادي حلفا', 'Wadi Halfa', 21.8, 31.35),
  SudanCity('el_obeid', 'الأبيض', 'El Obeid', 13.183, 30.217),
  SudanCity('kosti', 'كوستي', 'Kosti', 13.163, 32.663),
  SudanCity('rabak', 'ربك', 'Rabak', 13.183, 32.742),
  SudanCity('ed_dueim', 'الدويم', 'Ed Dueim', 14.0, 32.3),
  SudanCity('sennar', 'سنار', 'Sennar', 13.55, 33.6),
  SudanCity('singa', 'سنجة', 'Singa', 13.15, 33.933),
  SudanCity('ed_damazin', 'الدمازين', 'Ed Damazin', 11.789, 34.359),
  SudanCity('nyala', 'نيالا', 'Nyala', 12.05, 24.88),
  SudanCity('el_fasher', 'الفاشر', 'El Fasher', 13.628, 25.349),
  SudanCity('el_geneina', 'الجنينة', 'El Geneina', 13.45, 22.45),
  SudanCity('zalingei', 'زالنجي', 'Zalingei', 12.91, 23.47),
  SudanCity('ed_daein', 'الضعين', 'Ed Daein', 11.46, 26.13),
  SudanCity('kadugli', 'كادقلي', 'Kadugli', 11.011, 29.718),
  SudanCity('al_fula', 'الفولة', 'Al Fula', 11.993, 28.34),
  SudanCity('tokar', 'طوكر', 'Tokar', 18.433, 37.733),
];

/// The push topic of the customers of [cityId] who read [languageCode]
/// ('ar' or anything else for English). The push relay sends "a company now
/// serves your city" to this topic, in that language.
String cityPushTopic(String cityId, String languageCode) =>
    'city_${cityId}_${languageCode == 'ar' ? 'ar' : 'en'}';

List<SudanCity> _directory = builtInCities;
Map<String, SudanCity> _citiesById = {
  for (final city in builtInCities) city.id: city,
};

/// Replaces the list the app works with (the one Platform Admin saved). An
/// empty list is ignored: the built-in one stays.
void setCityDirectory(List<SudanCity> cities) {
  if (cities.isEmpty) return;
  _directory = List.unmodifiable(cities);
  _citiesById = {for (final city in cities) city.id: city};
}

/// Back to the built-in list (signing out, and tests).
void resetCityDirectory() => setCityDirectory(builtInCities);

/// Reads the cities of `platform_settings/cities`, or the built-in list when
/// the document is missing or holds nothing usable.
List<SudanCity> citiesFromDocument(Map<String, dynamic>? data) {
  final items = data?['items'];
  if (items is! List) return builtInCities;
  final cities = <SudanCity>[];
  final seen = <String>{};
  for (final raw in items) {
    final city = SudanCity.tryFromMap(raw);
    if (city != null && seen.add(city.id)) cities.add(city);
  }
  return cities.isEmpty ? builtInCities : cities;
}

/// Every city, hidden ones too (for names and for what is already saved).
List<SudanCity> get sudanCities => _directory;

/// The cities that can still be chosen.
List<SudanCity> get activeCities => [
  for (final city in _directory)
    if (city.active) city,
];

/// The city with [id], or null for a missing or unknown id.
SudanCity? cityById(String? id) => id == null ? null : _citiesById[id];

/// Whether [id] is a city of the list.
bool isKnownCityId(String? id) => cityById(id) != null;

/// Keeps the ids once each: the cities of the list first, in list order, then
/// any other id (a city this phone has not heard of yet is kept, never
/// dropped). Anything that is not a non-empty text is ignored.
List<String> normalizeCityIds(Iterable<Object?> ids) {
  final wanted = {
    for (final id in ids)
      if (id is String && id.isNotEmpty) id,
  };
  return [
    for (final city in _directory)
      if (wanted.contains(city.id)) city.id,
    for (final id in wanted)
      if (!_citiesById.containsKey(id)) id,
  ];
}

/// The names of [ids] in [languageCode], joined for display. Unknown ids are
/// skipped.
String cityNamesText(Iterable<String> ids, String languageCode) {
  return [
    for (final id in ids)
      if (cityById(id) case final city?) city.name(languageCode),
  ].join(languageCode == 'ar' ? '، ' : ', ');
}

/// The city whose centre is nearest to the point, or null when even the
/// nearest one is farther than [maxKm] (the person is not near any listed
/// city, so nothing sensible can be suggested). Cities without a position and
/// hidden ones are never suggested.
SudanCity? nearestCity(double latitude, double longitude, {double maxKm = 300}) {
  SudanCity? best;
  var bestKm = double.infinity;
  for (final city in _directory) {
    final cityLatitude = city.latitude;
    final cityLongitude = city.longitude;
    if (!city.active || cityLatitude == null || cityLongitude == null) continue;
    final km = _distanceKm(latitude, longitude, cityLatitude, cityLongitude);
    if (km < bestKm) {
      bestKm = km;
      best = city;
    }
  }
  return bestKm <= maxKm ? best : null;
}

double _distanceKm(double lat1, double lon1, double lat2, double lon2) {
  const earthKm = 6371.0;
  double rad(double deg) => deg * math.pi / 180;
  final dLat = rad(lat2 - lat1);
  final dLon = rad(lon2 - lon1);
  final a = math.pow(math.sin(dLat / 2), 2) +
      math.cos(rad(lat1)) *
          math.cos(rad(lat2)) *
          math.pow(math.sin(dLon / 2), 2);
  return 2 * earthKm * math.asin(math.sqrt(a));
}

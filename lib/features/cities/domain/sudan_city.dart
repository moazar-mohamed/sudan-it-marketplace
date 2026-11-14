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
    this.active = true,
  ]);

  final String id;
  final String nameAr;
  final String nameEn;

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
    return SudanCity(
      id,
      ar.isEmpty ? en : ar,
      en.isEmpty ? ar : en,
      raw['active'] != false,
    );
  }
}

const builtInCities = <SudanCity>[
  SudanCity('khartoum', 'الخرطوم', 'Khartoum'),
  SudanCity('omdurman', 'أم درمان', 'Omdurman'),
  SudanCity('bahri', 'الخرطوم بحري', 'Khartoum Bahri'),
  SudanCity('port_sudan', 'بورتسودان', 'Port Sudan'),
  SudanCity('wad_madani', 'ود مدني', 'Wad Madani'),
  SudanCity('kassala', 'كسلا', 'Kassala'),
  SudanCity('gedaref', 'القضارف', 'Gedaref'),
  SudanCity('atbara', 'عطبرة', 'Atbara'),
  SudanCity('shendi', 'شندي', 'Shendi'),
  SudanCity('ed_damer', 'الدامر', 'Ed Damer'),
  SudanCity('berber', 'بربر', 'Berber'),
  SudanCity('dongola', 'دنقلا', 'Dongola'),
  SudanCity('wadi_halfa', 'وادي حلفا', 'Wadi Halfa'),
  SudanCity('el_obeid', 'الأبيض', 'El Obeid'),
  SudanCity('kosti', 'كوستي', 'Kosti'),
  SudanCity('rabak', 'ربك', 'Rabak'),
  SudanCity('ed_dueim', 'الدويم', 'Ed Dueim'),
  SudanCity('sennar', 'سنار', 'Sennar'),
  SudanCity('singa', 'سنجة', 'Singa'),
  SudanCity('ed_damazin', 'الدمازين', 'Ed Damazin'),
  SudanCity('nyala', 'نيالا', 'Nyala'),
  SudanCity('el_fasher', 'الفاشر', 'El Fasher'),
  SudanCity('el_geneina', 'الجنينة', 'El Geneina'),
  SudanCity('zalingei', 'زالنجي', 'Zalingei'),
  SudanCity('ed_daein', 'الضعين', 'Ed Daein'),
  SudanCity('kadugli', 'كادقلي', 'Kadugli'),
  SudanCity('al_fula', 'الفولة', 'Al Fula'),
  SudanCity('tokar', 'طوكر', 'Tokar'),
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


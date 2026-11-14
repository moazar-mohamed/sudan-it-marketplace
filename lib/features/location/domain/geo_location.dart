/// A validated GPS point. Coordinates are always numbers, never strings.
class GeoLocation {
  const GeoLocation(this.latitude, this.longitude);

  final double latitude;
  final double longitude;

  static bool isValidLatitude(double value) =>
      value.isFinite && value >= -90 && value <= 90;

  static bool isValidLongitude(double value) =>
      value.isFinite && value >= -180 && value <= 180;

  /// Builds a point from stored values. Returns null unless BOTH values are
  /// real numbers inside the valid range, so legacy documents (no fields, or a
  /// string/garbage value) simply have no coordinates.
  static GeoLocation? tryCreate(Object? latitude, Object? longitude) {
    if (latitude is! num || longitude is! num) {
      return null;
    }
    final lat = latitude.toDouble();
    final lng = longitude.toDouble();
    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      return null;
    }
    return GeoLocation(lat, lng);
  }

  /// Fixed six-decimal text (about 0.1 m), the same precision shown in the UI.
  String get latitudeText => latitude.toStringAsFixed(6);
  String get longitudeText => longitude.toStringAsFixed(6);

  @override
  bool operator ==(Object other) =>
      other is GeoLocation &&
      other.latitude == latitude &&
      other.longitude == longitude;

  @override
  int get hashCode => Object.hash(latitude, longitude);

  @override
  String toString() => 'GeoLocation($latitudeText, $longitudeText)';
}

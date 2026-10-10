import '../../../location/domain/geo_location.dart';

/// One place a customer can collect an order from: a branch, a warehouse or
/// the shop itself. A company with none follows its own location.
class PickupPoint {
  const PickupPoint({
    required this.name,
    this.address = '',
    this.latitude,
    this.longitude,
  });

  /// Upper bounds, kept in step with `isValidPickupPoints` in firestore.rules.
  static const maxPerCompany = 5;
  static const maxNameLength = 60;
  static const maxAddressLength = 200;

  final String name;
  final String address;
  final double? latitude;
  final double? longitude;

  /// The exact map point, or null when only an address was given.
  GeoLocation? get coordinates => GeoLocation.tryCreate(latitude, longitude);

  /// The text saved on an order and shown to the customer.
  String get label {
    final place = address.trim();
    final title = name.trim();
    if (title.isEmpty) {
      return place;
    }
    return place.isEmpty ? title : '$title — $place';
  }

  PickupPoint copyWith({
    String? name,
    String? address,
    GeoLocation? coordinates,
    bool clearCoordinates = false,
  }) {
    return PickupPoint(
      name: name ?? this.name,
      address: address ?? this.address,
      latitude: clearCoordinates ? null : (coordinates?.latitude ?? latitude),
      longitude: clearCoordinates ? null : (coordinates?.longitude ?? longitude),
    );
  }

  Map<String, dynamic> toMap() {
    final point = coordinates;
    return {
      'name': name,
      'address': address,
      if (point != null) 'latitude': point.latitude,
      if (point != null) 'longitude': point.longitude,
    };
  }

  /// Null for anything that is not a usable point, so one bad entry never
  /// hides the rest.
  static PickupPoint? tryFromMap(Object? value) {
    if (value is! Map) {
      return null;
    }
    String text(String key) {
      final raw = value[key];
      return raw is String ? raw.trim() : '';
    }

    final point = GeoLocation.tryCreate(value['latitude'], value['longitude']);
    final result = PickupPoint(
      name: text('name'),
      address: text('address'),
      latitude: point?.latitude,
      longitude: point?.longitude,
    );
    return result.name.isEmpty ? null : result;
  }

  @override
  bool operator ==(Object other) =>
      other is PickupPoint &&
      other.name == name &&
      other.address == address &&
      other.latitude == latitude &&
      other.longitude == longitude;

  @override
  int get hashCode => Object.hash(name, address, latitude, longitude);
}

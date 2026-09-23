import '../../../location/domain/geo_location.dart';
import 'payment_account.dart';

class Company {
  const Company({
    required this.id,
    required this.name,
    required this.rating,
    required this.reviewCount,
    this.logoUrl,
    this.description,
    this.city,
    this.address,
    this.latitude,
    this.longitude,
    this.phone,
    this.email,
    this.pickupAddress,
    this.status = 'active',
    this.paymentAccounts = const [],
  });

  final String id;
  final String name;
  final double rating;
  final int reviewCount;
  final String? logoUrl;
  final String? description;
  final String? city;

  /// The company's written location. Legacy companies only have this.
  final String? address;

  /// Exact map point of the company. Optional: null for text-only companies.
  final double? latitude;
  final double? longitude;
  final String? phone;
  final String? email;

  /// Where customers collect orders when delivery is not available.
  final String? pickupAddress;

  /// pending | active | rejected | inactive, set by the platform admin.
  /// Companies without a stored status are treated as active.
  final String status;

  /// Where customers transfer manual payments for this company's orders.
  final List<PaymentAccount> paymentAccounts;

  /// Only active companies (and their products) are shown to customers.
  bool get isActive => status == 'active';

  /// The written location (null when empty).
  String? get locationText {
    final text = address?.trim() ?? '';
    return text.isEmpty ? null : text;
  }

  /// The exact map point, or null for text-only companies.
  GeoLocation? get coordinates => GeoLocation.tryCreate(latitude, longitude);

  bool get hasCoordinates => coordinates != null;

  /// [coordinates] replaces the stored map point; pass [clearCoordinates] to
  /// remove it (a null [coordinates] alone means "leave unchanged").
  Company copyWith({
    String? name,
    String? logoUrl,
    String? description,
    String? city,
    String? address,
    GeoLocation? coordinates,
    bool clearCoordinates = false,
    String? phone,
    String? email,
    String? pickupAddress,
  }) {
    return Company(
      id: id,
      name: name ?? this.name,
      rating: rating,
      reviewCount: reviewCount,
      logoUrl: logoUrl ?? this.logoUrl,
      description: description ?? this.description,
      city: city ?? this.city,
      address: address ?? this.address,
      latitude: clearCoordinates ? null : (coordinates?.latitude ?? latitude),
      longitude: clearCoordinates ? null : (coordinates?.longitude ?? longitude),
      phone: phone ?? this.phone,
      email: email ?? this.email,
      pickupAddress: pickupAddress ?? this.pickupAddress,
      status: status,
      paymentAccounts: paymentAccounts,
    );
  }
}

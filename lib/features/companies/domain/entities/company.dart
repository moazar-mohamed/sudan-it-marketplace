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
    this.phone,
    this.email,
    this.pickupAddress,
  });

  final String id;
  final String name;
  final double rating;
  final int reviewCount;
  final String? logoUrl;
  final String? description;
  final String? city;
  final String? address;
  final String? phone;
  final String? email;

  /// Where customers collect orders when delivery is not available.
  final String? pickupAddress;

  Company copyWith({
    String? name,
    String? logoUrl,
    String? description,
    String? city,
    String? address,
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
      phone: phone ?? this.phone,
      email: email ?? this.email,
      pickupAddress: pickupAddress ?? this.pickupAddress,
    );
  }
}

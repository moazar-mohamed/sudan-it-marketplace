class CompanyService {
  const CompanyService({
    required this.id,
    required this.companyId,
    required this.serviceId,
    required this.isActive,
    required this.createdAt,
    this.price,
    this.note,
  });

  final String id;
  final String companyId;
  final String serviceId;
  final bool isActive;
  final DateTime createdAt;

  /// The company's own price for this service. Optional: `null` means the
  /// company set no price, and then nothing is shown. Never stored as 0.
  final double? price;

  /// The company's own short text about how it performs this service.
  final String? note;

  bool get hasPrice => price != null;

  /// The note, or null when it is empty.
  String? get noteText {
    final text = note?.trim() ?? '';
    return text.isEmpty ? null : text;
  }
}

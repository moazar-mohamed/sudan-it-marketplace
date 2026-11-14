/// What the app tells the platform about how it is used. Nothing personal: that
/// a person opened the app on a day, and that a product was opened.
abstract class UsageRepository {
  /// This person opened the app on [day] (`2026-10-04`). Written once per
  /// person per day; a second write is refused by the rules.
  Future<void> recordActiveDay({
    required String day,
    required String userId,
    required String role,
  });

  /// A customer opened this product: one is added to its running count.
  Future<void> recordProductView(String productId);
}

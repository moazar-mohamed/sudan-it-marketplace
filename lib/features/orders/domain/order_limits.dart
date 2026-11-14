/// Length limits of the order texts the app builds itself. They mirror
/// `isValidOrderCreate` in `firestore.rules`, which is what actually enforces
/// them. Checkout keeps what it writes inside them, so an order is never
/// refused for its length after the customer has already paid.
///
/// The other limits need nothing here: the product and company names are
/// copied from the product (200 each), the phone field only produces numbers
/// of at most 16 characters (30 allowed), and a receipt's file name is cut to
/// its own limit when the image is prepared.
class OrderLimits {
  const OrderLimits._();

  /// The customer's name as copied onto the order.
  static const customerName = 120;

  /// The typed delivery address, or the pickup text built from the company's
  /// own address.
  static const deliveryAddress = 500;
}

import 'dart:typed_data';

/// Limits of a stored payment receipt. They mirror `isValidReceiptCreate` in
/// `firestore.rules`, which is what actually enforces them.
class ReceiptLimits {
  const ReceiptLimits._();

  /// Largest image (bytes) the rules accept. A Firestore document is capped at
  /// 1 MiB, so this leaves room for the other fields.
  static const maxBytes = 700000;

  /// What the app aims for, so the free 1 GiB database lasts as long as
  /// possible: 150-350 KB is typical for a screenshot of a bank receipt.
  static const targetBytes = 350000;

  /// Longest side, in pixels, of the stored image.
  static const maxLongEdge = 1280;

  /// Largest width or height the rules accept.
  static const maxDimension = 4096;

  static const maxFileNameLength = 100;

  static const contentType = 'image/jpeg';
}

/// A receipt image ready to be stored with a new order: already compressed to
/// JPEG within [ReceiptLimits].
class ReceiptImage {
  const ReceiptImage({
    required this.fileName,
    required this.bytes,
    required this.width,
    required this.height,
  });

  final String fileName;
  final Uint8List bytes;
  final int width;
  final int height;

  int get sizeBytes => bytes.length;
}

/// A stored receipt, as read back from `order_receipts/{orderId}`.
class OrderReceipt {
  const OrderReceipt({
    required this.orderId,
    required this.customerId,
    required this.companyId,
    required this.image,
    this.createdAt,
  });

  final String orderId;
  final String customerId;
  final String companyId;
  final ReceiptImage image;
  final DateTime? createdAt;
}

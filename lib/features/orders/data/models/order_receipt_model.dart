import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/order_receipt.dart';

/// Firestore mapping of a payment receipt (`order_receipts/{orderId}`).
///
/// The image is stored as a native `bytes` value (a [Blob]), never base64 and
/// never a URL. The key set matches `isValidReceiptCreate` in the rules, which
/// refuses any other field.
class OrderReceiptModel {
  const OrderReceiptModel._();

  static const collection = 'order_receipts';

  static const createKeys = {
    'orderId',
    'customerId',
    'companyId',
    'fileName',
    'contentType',
    'image',
    'sizeBytes',
    'width',
    'height',
    'createdAt',
  };

  static Map<String, dynamic> toFirestoreCreateMap({
    required String orderId,
    required String customerId,
    required String companyId,
    required ReceiptImage image,
  }) {
    return {
      'orderId': orderId,
      'customerId': customerId,
      'companyId': companyId,
      'fileName': image.fileName,
      'contentType': ReceiptLimits.contentType,
      'image': Blob(image.bytes),
      'sizeBytes': image.sizeBytes,
      'width': image.width,
      'height': image.height,
      'createdAt': FieldValue.serverTimestamp(),
    };
  }

  /// Null when the document is missing or unreadable (never throws on bad data).
  static OrderReceipt? fromMap(String id, Map<String, dynamic>? data) {
    if (data == null) return null;
    final image = data['image'];
    final width = data['width'];
    final height = data['height'];
    if (image is! Blob || width is! int || height is! int) return null;
    final created = data['createdAt'];
    return OrderReceipt(
      orderId: (data['orderId'] as String?) ?? id,
      customerId: (data['customerId'] as String?) ?? '',
      companyId: (data['companyId'] as String?) ?? '',
      image: ReceiptImage(
        fileName: (data['fileName'] as String?) ?? 'receipt.jpg',
        bytes: image.bytes,
        width: width,
        height: height,
      ),
      createdAt: created is Timestamp ? created.toDate() : null,
    );
  }
}

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/services/receipt_image_compressor.dart';

enum ReceiptSource { gallery, camera }

/// A file the customer picked, before it is compressed.
class PickedReceiptFile {
  const PickedReceiptFile({required this.name, required this.bytes});

  final String name;
  final Uint8List bytes;
}

enum ReceiptPickFailure {
  cameraDenied,
  galleryDenied,
  cameraUnavailable,
  unsupported,
  tooLarge,
  failed,
}

class ReceiptPickException implements Exception {
  const ReceiptPickException(this.failure);

  final ReceiptPickFailure failure;

  @override
  String toString() => 'ReceiptPickException($failure)';
}

/// Picks a receipt image. Returns null when the customer dismissed the picker;
/// throws [ReceiptPickException] when it could not be read.
typedef ReceiptPicker = Future<PickedReceiptFile?> Function(ReceiptSource source);

/// Largest original the app will even try to decode; anything bigger is refused
/// before it can exhaust the phone's memory.
const maxPickedReceiptBytes = 25 * 1024 * 1024;

/// Accepts the bytes the picker returned, or throws [ReceiptPickException].
///
/// The file name and MIME type are deliberately NOT used to decide whether the
/// file is an image: the platform picker re-encodes what it returns (a HEIC
/// photo comes back as JPEG bytes that still carry the `.heic` name), so the
/// name can disagree with the content. Whether the bytes really are an image
/// is decided by decoding them in [ReceiptImageCompressor], which refuses
/// anything it cannot read (a PDF, a damaged file, an undecodable HEIC).
PickedReceiptFile acceptPickedReceipt({required String name, required Uint8List bytes}) {
  if (bytes.isEmpty) {
    throw const ReceiptPickException(ReceiptPickFailure.unsupported);
  }
  if (bytes.length > maxPickedReceiptBytes) {
    throw const ReceiptPickException(ReceiptPickFailure.tooLarge);
  }
  return PickedReceiptFile(name: name, bytes: bytes);
}

Future<PickedReceiptFile?> pickReceiptFile(ReceiptSource source) async {
  final camera = source == ReceiptSource.camera;
  try {
    final file = await ImagePicker().pickImage(
      source: camera ? ImageSource.camera : ImageSource.gallery,
      // Shrunk by the platform first, so a 50-megapixel photo is never decoded
      // in full; the compressor then makes the final small JPEG.
      maxWidth: 2000,
      maxHeight: 2000,
    );
    if (file == null) return null;
    // Refuse an oversized original before reading it into memory.
    if (await file.length() > maxPickedReceiptBytes) {
      throw const ReceiptPickException(ReceiptPickFailure.tooLarge);
    }
    return acceptPickedReceipt(name: file.name, bytes: await file.readAsBytes());
  } on ReceiptPickException {
    rethrow;
  } on PlatformException catch (error) {
    if (error.code.contains('access_denied')) {
      throw ReceiptPickException(
        camera ? ReceiptPickFailure.cameraDenied : ReceiptPickFailure.galleryDenied,
      );
    }
    if (camera && error.code == 'no_available_camera') {
      throw const ReceiptPickException(ReceiptPickFailure.cameraUnavailable);
    }
    throw const ReceiptPickException(ReceiptPickFailure.failed);
  } catch (_) {
    // e.g. a platform without camera support.
    throw ReceiptPickException(
      camera ? ReceiptPickFailure.cameraUnavailable : ReceiptPickFailure.failed,
    );
  }
}

/// Overridable in tests, so no real picker or image work is needed.
final receiptPickerProvider = Provider<ReceiptPicker>((ref) => pickReceiptFile);

final receiptCompressorProvider =
    Provider<ReceiptImageCompressor>((ref) => const ReceiptImageCompressor());

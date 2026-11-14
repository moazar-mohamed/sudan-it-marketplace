import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

import '../../features/orders/domain/entities/order_receipt.dart';

enum ReceiptCompressionError {
  /// The bytes are not an image the app can decode.
  unreadable,

  /// Even the strongest compression stays over the size limit.
  tooLarge,
}

class ReceiptCompressionException implements Exception {
  const ReceiptCompressionException(this.error);

  final ReceiptCompressionError error;

  @override
  String toString() => 'ReceiptCompressionException($error)';
}

/// Shrinks a picked receipt (photo or screenshot, JPEG/PNG/WebP/GIF/...) to a
/// small JPEG that fits in a Firestore document.
///
/// It tries gentler settings first and stops at the first result within
/// [targetBytes]; if none gets there it keeps the smallest result as long as it
/// is within [maxBytes]. Transparency is flattened onto white and the photo's
/// orientation is applied, so the stored image always looks like the original.
/// The work runs in a background isolate, so the screen stays responsive.
class ReceiptImageCompressor {
  const ReceiptImageCompressor({
    this.targetBytes = ReceiptLimits.targetBytes,
    this.maxBytes = ReceiptLimits.maxBytes,
    this.maxLongEdge = ReceiptLimits.maxLongEdge,
  });

  final int targetBytes;
  final int maxBytes;
  final int maxLongEdge;

  /// (longest side, JPEG quality), from best quality to smallest size.
  static const ladder = <(int, int)>[
    (1280, 70),
    (1280, 55),
    (1024, 55),
    (1024, 45),
    (800, 45),
    (640, 40),
  ];

  /// Throws [ReceiptCompressionException].
  Future<ReceiptImage> compress(Uint8List source, {required String fileName}) async {
    final job = _Job(source, targetBytes, maxBytes, maxLongEdge);
    final result = await compute(_compressJob, job);
    if (result.failure != null) {
      throw ReceiptCompressionException(result.failure!);
    }
    return ReceiptImage(
      fileName: jpegName(fileName),
      bytes: result.bytes!,
      width: result.width,
      height: result.height,
    );
  }

  /// The stored name: the picked file's base name, always ending in `.jpg`,
  /// within the length the rules allow.
  static String jpegName(String name) {
    var base = name.split(RegExp(r'[\\/]')).last.trim();
    final dot = base.lastIndexOf('.');
    if (dot > 0) base = base.substring(0, dot);
    if (base.isEmpty) base = 'receipt';
    const suffix = '.jpg';
    if (base.length > ReceiptLimits.maxFileNameLength - suffix.length) {
      base = base.substring(0, ReceiptLimits.maxFileNameLength - suffix.length);
    }
    return '$base$suffix';
  }
}

class _Job {
  const _Job(this.source, this.targetBytes, this.maxBytes, this.maxLongEdge);

  final Uint8List source;
  final int targetBytes;
  final int maxBytes;
  final int maxLongEdge;
}

class _Result {
  const _Result.ok(this.bytes, this.width, this.height) : failure = null;
  const _Result.failed(this.failure)
      : bytes = null,
        width = 0,
        height = 0;

  final Uint8List? bytes;
  final int width;
  final int height;
  final ReceiptCompressionError? failure;
}

_Result _compressJob(_Job job) {
  img.Image? decoded;
  try {
    decoded = img.decodeImage(job.source);
  } catch (_) {
    decoded = null;
  }
  if (decoded == null || decoded.width < 1 || decoded.height < 1) {
    return const _Result.failed(ReceiptCompressionError.unreadable);
  }

  var image = img.bakeOrientation(decoded);
  if (image.hasAlpha) {
    // JPEG has no transparency: flatten onto white, like a printed receipt.
    final flat = img.Image(width: image.width, height: image.height);
    img.fill(flat, color: img.ColorRgb8(255, 255, 255));
    img.compositeImage(flat, image);
    image = flat;
  }

  Uint8List? best;
  var bestWidth = 0;
  var bestHeight = 0;
  for (final (edge, quality) in ReceiptImageCompressor.ladder) {
    final longEdge = math.min(edge, job.maxLongEdge);
    final scaled = _fitLongEdge(image, longEdge);
    final bytes = Uint8List.fromList(img.encodeJpg(scaled, quality: quality));
    if (best == null || bytes.length < best.length) {
      best = bytes;
      bestWidth = scaled.width;
      bestHeight = scaled.height;
    }
    if (bytes.length <= job.targetBytes) break;
  }

  if (best == null || best.length > job.maxBytes) {
    return const _Result.failed(ReceiptCompressionError.tooLarge);
  }
  return _Result.ok(best, bestWidth, bestHeight);
}

/// [source] scaled down so its longest side is at most [longEdge] (never up).
img.Image _fitLongEdge(img.Image source, int longEdge) {
  final current = math.max(source.width, source.height);
  if (current <= longEdge) return source;
  final scale = longEdge / current;
  return img.copyResize(
    source,
    width: math.max(1, (source.width * scale).round()),
    height: math.max(1, (source.height * scale).round()),
    interpolation: img.Interpolation.average,
  );
}

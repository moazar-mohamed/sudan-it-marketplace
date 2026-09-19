import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// An image the user picked from the gallery or camera, not yet uploaded.
class PickedImage {
  const PickedImage({required this.bytes, required this.contentType});

  final Uint8List bytes;
  final String contentType;

  /// File extension matching [contentType], used to name the stored file.
  String get extension => switch (contentType) {
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        _ => 'jpg',
      };
}

class ImageUploadException implements Exception {
  const ImageUploadException(this.code);

  final String code;

  @override
  String toString() => 'ImageUploadException($code)';
}

/// Rules shared by every image input. The limits match `storage.rules`.
class ImageRules {
  const ImageRules._();

  static const maxBytes = 5 * 1024 * 1024;

  static const _contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
  };

  /// Returns the image content type for a file name, or null when the file is
  /// not a supported image (jpg, png, webp, gif).
  static String? contentTypeForName(String name) {
    final dot = name.lastIndexOf('.');
    if (dot < 0 || dot == name.length - 1) {
      return null;
    }
    return _contentTypes[name.substring(dot + 1).toLowerCase()];
  }

  /// Same as [contentTypeForName] for a picker-reported MIME type.
  static String? contentTypeForMime(String? mime) {
    final value = mime?.toLowerCase();
    return _contentTypes.containsValue(value) ? value : null;
  }

  /// True for a non-empty http(s) link with a host.
  static bool isValidImageUrl(String value) {
    final uri = Uri.tryParse(value.trim());
    return uri != null &&
        (uri.scheme == 'http' || uri.scheme == 'https') &&
        uri.host.isNotEmpty;
  }
}

/// Uploads picked images to Firebase Storage through the existing client
/// setup and returns the public download URL to store in Firestore.
class ImageUploadService {
  ImageUploadService({FirebaseStorage? storage})
      : _storage = storage ?? FirebaseStorage.instance;

  final FirebaseStorage _storage;

  /// Stores [image] as a new file under [folder] and returns its download URL.
  /// Every upload gets a fresh name, so replacing an image never overwrites
  /// the previous file.
  Future<String> upload(PickedImage image, {required String folder}) async {
    try {
      final name = '${DateTime.now().millisecondsSinceEpoch}.${image.extension}';
      final ref = _storage.ref('$folder/$name');
      await ref.putData(
        image.bytes,
        SettableMetadata(contentType: image.contentType),
      );
      return await ref.getDownloadURL();
    } on FirebaseException catch (error) {
      throw ImageUploadException(error.code);
    } catch (_) {
      throw const ImageUploadException('upload-failed');
    }
  }
}

final imageUploadServiceProvider = Provider<ImageUploadService>(
  (ref) => ImageUploadService(),
);

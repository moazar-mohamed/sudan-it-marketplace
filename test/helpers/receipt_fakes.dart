import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:sudan_it_marketplace/core/services/receipt_image_compressor.dart';
import 'package:sudan_it_marketplace/features/orders/data/datasources/orders_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/orders/data/models/order_model.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_receipt.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/receipt_picker.dart';
import 'package:flutter_test/flutter_test.dart';

/// A synthetic "bank receipt screenshot": white page, dark text-like bars and a
/// coloured header. Compresses like the real thing (flat areas + sharp edges).
img.Image receiptLikeImage({int width = 1080, int height = 2400}) {
  final image = img.Image(width: width, height: height);
  img.fill(image, color: img.ColorRgb8(255, 255, 255));
  img.fillRect(
    image,
    x1: 0,
    y1: 0,
    x2: width,
    y2: height ~/ 8,
    color: img.ColorRgb8(21, 101, 192),
  );
  for (var row = 0; row < 30; row++) {
    final y = height ~/ 6 + row * (height ~/ 40);
    img.fillRect(
      image,
      x1: width ~/ 10,
      y1: y,
      x2: width ~/ 10 + (width ~/ 3) * (1 + row % 2),
      y2: y + height ~/ 90,
      color: img.ColorRgb8(30, 30, 30),
    );
  }
  return image;
}

/// Random noise: worst case for JPEG (a busy photo).
img.Image noiseImage({int width = 2000, int height = 1500, int seed = 7}) {
  final random = math.Random(seed);
  final image = img.Image(width: width, height: height);
  for (final pixel in image) {
    pixel
      ..r = random.nextInt(256)
      ..g = random.nextInt(256)
      ..b = random.nextInt(256);
  }
  return image;
}

Uint8List png(img.Image image) => Uint8List.fromList(img.encodePng(image));
Uint8List jpg(img.Image image, {int quality = 80}) =>
    Uint8List.fromList(img.encodeJpg(image, quality: quality));

bool isJpeg(Uint8List bytes) =>
    bytes.length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;

/// A small, valid, already-compressed receipt.
ReceiptImage smallReceipt({String fileName = 'slip.jpg'}) {
  final image = receiptLikeImage(width: 200, height: 300);
  return ReceiptImage(
    fileName: fileName,
    bytes: jpg(image),
    width: image.width,
    height: image.height,
  );
}

/// A picker that returns [file] (or throws [failure]) and records its calls.
class FakePicker {
  FakePicker({this.file, this.failure});

  PickedReceiptFile? file;
  ReceiptPickFailure? failure;
  final sources = <ReceiptSource>[];

  Future<PickedReceiptFile?> call(ReceiptSource source) async {
    sources.add(source);
    if (failure != null) throw ReceiptPickException(failure!);
    return file;
  }
}

/// A compressor that does no image work: returns [result] (or throws), and can
/// be held back with [gate] to look at the "preparing" state.
class FakeCompressor extends ReceiptImageCompressor {
  FakeCompressor({this.result, this.error, this.gate});

  ReceiptImage? result;
  ReceiptCompressionError? error;
  Completer<void>? gate;
  int calls = 0;

  @override
  Future<ReceiptImage> compress(Uint8List source, {required String fileName}) async {
    calls++;
    if (gate != null) await gate!.future;
    if (error != null) throw ReceiptCompressionException(error!);
    return result ?? smallReceipt();
  }
}

/// Records every order created and every receipt read.
class FakeOrdersRemote extends Fake implements OrdersRemoteDataSource {
  final createdOrders = <OrderModel>[];
  final createdReceipts = <ReceiptImage?>[];
  final receiptReads = <String>[];

  /// What [getReceipt] returns; use [receiptError] to make it fail.
  OrderReceipt? storedReceipt;
  Object? receiptError;
  Completer<void>? receiptGate;
  Object? createError;

  @override
  Future<String> createOrder(OrderModel order, {ReceiptImage? receipt}) async {
    if (createError != null) throw createError!;
    createdOrders.add(order);
    createdReceipts.add(receipt);
    return order.id;
  }

  @override
  Future<OrderReceipt?> getReceipt(String orderId) async {
    receiptReads.add(orderId);
    if (receiptGate != null) await receiptGate!.future;
    if (receiptError != null) throw receiptError!;
    return storedReceipt;
  }
}

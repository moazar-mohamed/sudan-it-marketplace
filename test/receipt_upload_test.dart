import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:sudan_it_marketplace/core/errors/app_exception.dart';
import 'package:sudan_it_marketplace/core/services/receipt_image_compressor.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/payment_account.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notifications_providers.dart';
import 'package:sudan_it_marketplace/features/orders/data/models/order_receipt_model.dart';
import 'package:sudan_it_marketplace/features/orders/data/repositories/orders_repository_impl.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/checkout_order_draft.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_receipt.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/manual_payment_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_pending_verification_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/receipt_picker.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/widgets/receipt_viewer.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

import 'helpers/receipt_fakes.dart';

final _en = AppLocalizationsEn();
final _ar = AppLocalizationsAr();

const _draft = CheckoutOrderDraft(
  orderId: 'o1',
  customerId: 'cust1',
  companyId: 'c1',
  companyName: 'ABC Technology',
  productId: 'p1',
  productName: 'Router',
  quantity: 1,
  unitPrice: 1000,
  productSubtotal: 1000,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: 0,
  totalAmount: 1000,
  deliveryAddress: 'Khartoum',
  contactPhone: '0912345678',
);

const _company = Company(
  id: 'c1',
  name: 'ABC Technology',
  rating: 0,
  reviewCount: 0,
  paymentAccounts: [
    PaymentAccount(
      bankName: 'Bank of Khartoum',
      accountName: 'ABC Tech Co.',
      accountNumber: '7700123',
    ),
  ],
);

class _FakeNotifications extends Fake implements NotificationsRepository {
  @override
  String newNotificationId() => 'n1';

  @override
  Future<void> createNotification(AppNotification notification) async {}
}

OrderEntity _order({String? receiptFileName = 'slip.jpg'}) => OrderEntity(
      id: 'o1',
      customerId: 'cust1',
      companyId: 'c1',
      companyName: 'ABC Technology',
      productId: 'p1',
      productName: 'Router',
      quantity: 1,
      unitPrice: 1000,
      productSubtotal: 1000,
      installationSelected: false,
      installationFee: 0,
      deliveryFee: 0,
      totalAmount: 1000,
      deliveryAddress: 'Khartoum',
      contactPhone: '0912345678',
      receiptFileName: receiptFileName,
      createdAt: DateTime(2026),
    );

Widget _app(
  Widget home,
  FakeOrdersRemote remote, {
  FakePicker? picker,
  ReceiptImageCompressor? compressor,
  Locale locale = const Locale('en'),
}) =>
    ProviderScope(
      overrides: [
        resolvedCompanyProvider('c1').overrideWithValue(_company),
        ordersRepositoryProvider.overrideWithValue(OrdersRepositoryImpl(remote)),
        notificationsRepositoryProvider.overrideWithValue(_FakeNotifications()),
        if (picker != null) receiptPickerProvider.overrideWithValue(picker.call),
        if (compressor != null) receiptCompressorProvider.overrideWithValue(compressor),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: const [Locale('en'), Locale('ar')],
        locale: locale,
        home: home,
      ),
    );

PickedReceiptFile _file([String name = 'bankak.png']) =>
    PickedReceiptFile(name: name, bytes: png(receiptLikeImage(width: 100, height: 100)));

void main() {
  // ------------------------------------------------------------------ compressor
  group('receipt image compressor (real image work)', () {
    const compressor = ReceiptImageCompressor();

    test('a phone screenshot becomes a small JPEG within the limits', () async {
      final source = png(receiptLikeImage()); // 1080 x 2400
      final result = await compressor.compress(source, fileName: 'Screenshot 1.png');

      expect(isJpeg(result.bytes), isTrue);
      expect(result.bytes.length, lessThanOrEqualTo(ReceiptLimits.targetBytes));
      expect(result.width > result.height, isFalse); // still portrait
      expect(result.height, lessThanOrEqualTo(ReceiptLimits.maxLongEdge));
      // what was stored is really that image
      final decoded = img.decodeJpg(result.bytes)!;
      expect((decoded.width, decoded.height), (result.width, result.height));
      expect(result.fileName, 'Screenshot 1.jpg');
    });

    test('a busy photo still ends within the hard limit', () async {
      final source = jpg(noiseImage(), quality: 95);
      expect(source.length, greaterThan(ReceiptLimits.maxBytes)); // truly big
      final result = await compressor.compress(source, fileName: 'photo.jpg');
      expect(result.bytes.length, lessThan(source.length ~/ 3)); // genuinely much smaller
      expect(isJpeg(result.bytes), isTrue);
      expect(result.bytes.length, lessThanOrEqualTo(ReceiptLimits.maxBytes));
      expect(result.width, lessThanOrEqualTo(ReceiptLimits.maxDimension));
      expect(result.height, lessThanOrEqualTo(ReceiptLimits.maxDimension));
    });

    test('a small image is not enlarged', () async {
      final result = await compressor.compress(
        png(receiptLikeImage(width: 300, height: 200)),
        fileName: 'a.png',
      );
      expect((result.width, result.height), (300, 200));
    });

    test('the photo orientation is applied, so it is stored the right way up', () async {
      final tall = img.Image(width: 200, height: 100);
      img.fill(tall, color: img.ColorRgb8(200, 200, 200));
      tall.exif.imageIfd.orientation = 6; // camera held sideways: rotate 90 degrees
      final result = await compressor.compress(jpg(tall), fileName: 'p.jpg');
      expect((result.width, result.height), (100, 200));
    });

    test('transparency is flattened onto white, not black', () async {
      final ghost = img.Image(width: 64, height: 64, numChannels: 4);
      img.fill(ghost, color: img.ColorRgba8(0, 0, 0, 0)); // fully transparent
      final result = await compressor.compress(png(ghost), fileName: 't.png');
      final pixel = img.decodeJpg(result.bytes)!.getPixel(10, 10);
      expect(pixel.r, greaterThan(240));
      expect(pixel.g, greaterThan(240));
      expect(pixel.b, greaterThan(240));
    });

    test('other formats (GIF, BMP, WebP-less decoders aside) are converted too', () async {
      final image = receiptLikeImage(width: 200, height: 200);
      for (final bytes in [
        Uint8List.fromList(img.encodeGif(image)),
        Uint8List.fromList(img.encodeBmp(image)),
      ]) {
        final result = await compressor.compress(bytes, fileName: 'x');
        expect(isJpeg(result.bytes), isTrue);
      }
    });

    test('a file that is not an image is refused as unreadable', () async {
      for (final bytes in [Uint8List(0), Uint8List.fromList('hello'.codeUnits), Uint8List(500)]) {
        await expectLater(
          compressor.compress(bytes, fileName: 'x.pdf'),
          throwsA(
            isA<ReceiptCompressionException>()
                .having((e) => e.error, 'error', ReceiptCompressionError.unreadable),
          ),
        );
      }
    });

    test('the CONTENT decides, not the file name (HEIC name, wrong or missing extension)', () async {
      final image = receiptLikeImage(width: 300, height: 400);
      // The platform picker re-encodes a HEIC photo to JPEG but keeps its name.
      final jpegBytes = jpg(image);
      final pngBytes = png(image);
      for (final (name, bytes) in <(String, Uint8List)>[
        ('scaled_IMG_0001.heic', jpegBytes),
        ('IMG_0002.HEIF', jpegBytes),
        ('photo.png', jpegBytes), // JPEG content, PNG name
        ('photo.jpg', pngBytes), // PNG content, JPEG name
        ('photo.pdf', pngBytes),
        ('photo', jpegBytes), // no extension at all
        ('.heic', jpegBytes),
      ]) {
        final result = await compressor.compress(bytes, fileName: name);
        expect(isJpeg(result.bytes), isTrue, reason: name);
        expect((result.width, result.height), (300, 400), reason: name);
        expect(result.fileName.endsWith('.jpg'), isTrue, reason: name);
      }
      expect(
        (await compressor.compress(jpegBytes, fileName: 'scaled_IMG_0001.heic')).fileName,
        'scaled_IMG_0001.jpg',
      );
    });

    test('a real, undecodable HEIC container is refused as unreadable (never stored)', () async {
      // "ftyp heic" box header followed by data the decoder cannot use.
      final heic = Uint8List.fromList([
        0x00, 0x00, 0x00, 0x18, ...'ftypheic'.codeUnits, 0x00, 0x00, 0x00, 0x00,
        ...'mif1heic'.codeUnits,
        ...List<int>.filled(200, 0x5A),
      ]);
      await expectLater(
        compressor.compress(heic, fileName: 'IMG_0003.heic'),
        throwsA(
          isA<ReceiptCompressionException>()
              .having((e) => e.error, 'error', ReceiptCompressionError.unreadable),
        ),
      );
    });

    test('damaged files are refused as unreadable, whatever their name says', () async {
      final good = jpg(receiptLikeImage(width: 300, height: 400));
      final goodPng = png(receiptLikeImage(width: 300, height: 400));
      final damaged = <(String, Uint8List)>[
        ('cut.jpg', Uint8List.sublistView(good, 0, 20)), // JPEG cut off in the header
        ('cut.png', Uint8List.sublistView(goodPng, 0, 30)), // PNG cut off after the signature
        ('signature.jpg', Uint8List.fromList([0xFF, 0xD8, 0xFF])), // JPEG magic and nothing else
        ('pngsig.png', Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])),
        ('junk.jpg', Uint8List.fromList([0xFF, 0xD8, 0xFF, ...List<int>.filled(300, 0x11)])),
        ('doc.jpg', Uint8List.fromList('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n'.codeUnits)), // a PDF
        ('page.png', Uint8List.fromList('<html><body>hi</body></html>'.codeUnits)),
        ('empty.jpg', Uint8List(0)),
      ];
      for (final (name, bytes) in damaged) {
        await expectLater(
          compressor.compress(bytes, fileName: name),
          throwsA(
            isA<ReceiptCompressionException>()
                .having((e) => e.error, 'error', ReceiptCompressionError.unreadable),
          ),
          reason: name,
        );
      }
    });

    test('an image that cannot be made small enough is refused as too large', () async {
      const strict = ReceiptImageCompressor(targetBytes: 50, maxBytes: 100);
      await expectLater(
        strict.compress(jpg(noiseImage(width: 600, height: 600)), fileName: 'n.jpg'),
        throwsA(
          isA<ReceiptCompressionException>()
              .having((e) => e.error, 'error', ReceiptCompressionError.tooLarge),
        ),
      );
    });

    test('the stored file name is always a short .jpg name', () {
      expect(ReceiptImageCompressor.jpegName('IMG 1.PNG'), 'IMG 1.jpg');
      expect(ReceiptImageCompressor.jpegName('/storage/emulated/0/a/b/c.jpeg'), 'c.jpg');
      expect(ReceiptImageCompressor.jpegName(r'C:\pics\slip.webp'), 'slip.jpg');
      expect(ReceiptImageCompressor.jpegName('noextension'), 'noextension.jpg');
      expect(ReceiptImageCompressor.jpegName(''), 'receipt.jpg');
      expect(ReceiptImageCompressor.jpegName('.png'), '.png.jpg'); // a hidden-file style name is kept
      expect(
        ReceiptImageCompressor.jpegName('${'x' * 300}.png').length,
        ReceiptLimits.maxFileNameLength,
      );
    });
  });

  // ------------------------------------------------------- what the picker accepts
  group('accepting a picked file (the name is not trusted)', () {
    final jpegBytes = jpg(receiptLikeImage(width: 100, height: 100));

    test('HEIC-named, oddly named and unnamed files are passed on to the decoder', () {
      for (final name in ['scaled_IMG_0001.heic', 'IMG.HEIF', 'photo.png', 'photo', '.heic', 'x.avif']) {
        final file = acceptPickedReceipt(name: name, bytes: jpegBytes);
        expect(file.name, name);
        expect(file.bytes, jpegBytes);
      }
    });

    test('an empty file is refused as unsupported', () {
      expect(
        () => acceptPickedReceipt(name: 'a.jpg', bytes: Uint8List(0)),
        throwsA(
          isA<ReceiptPickException>()
              .having((e) => e.failure, 'failure', ReceiptPickFailure.unsupported),
        ),
      );
    });

    test('an oversized original is refused, one at the limit is not', () {
      expect(
        () => acceptPickedReceipt(name: 'a.jpg', bytes: Uint8List(maxPickedReceiptBytes + 1)),
        throwsA(
          isA<ReceiptPickException>()
              .having((e) => e.failure, 'failure', ReceiptPickFailure.tooLarge),
        ),
      );
      expect(
        acceptPickedReceipt(name: 'a.jpg', bytes: Uint8List(maxPickedReceiptBytes)).bytes.length,
        maxPickedReceiptBytes,
      );
    });

    test('it no longer depends on the image extension helpers', () {
      final source = File('lib/features/orders/presentation/receipt_picker.dart').readAsStringSync();
      expect(source.contains('contentTypeForName'), isFalse);
      expect(source.contains('contentTypeForMime'), isFalse);
      expect(source.contains('mimeType'), isFalse);
    });
  });

  // ------------------------------------------------- Firestore shape vs the rules
  group('what is written matches the security rules', () {
    final rules = File('firestore.rules').readAsStringSync();
    final block = rules.substring(rules.indexOf('function isValidReceiptCreate'));
    final ruleBlock = block.substring(0, block.indexOf('match /order_receipts'));

    Set<String> ruleKeys() {
      final list = RegExp(r'hasOnly\(\[([^\]]*)\]').firstMatch(ruleBlock)!.group(1)!;
      return RegExp(r"'(\w+)'").allMatches(list).map((m) => m.group(1)!).toSet();
    }

    test('the field names are exactly the ones the rules allow', () {
      final map = OrderReceiptModel.toFirestoreCreateMap(
        orderId: 'o1',
        customerId: 'cust1',
        companyId: 'c1',
        image: smallReceipt(),
      );
      expect(map.keys.toSet(), ruleKeys());
      expect(OrderReceiptModel.createKeys, ruleKeys());
    });

    test('the limits in the app equal the limits in the rules', () {
      expect(ruleBlock, contains('data.image.size() <= ${ReceiptLimits.maxBytes}'));
      expect(ruleBlock, contains("data.contentType == '${ReceiptLimits.contentType}'"));
      expect(ruleBlock, contains('data.fileName.size() <= ${ReceiptLimits.maxFileNameLength}'));
      expect(ruleBlock, contains('data.width <= ${ReceiptLimits.maxDimension}'));
      expect(ruleBlock, contains('data.height <= ${ReceiptLimits.maxDimension}'));
      expect(ReceiptLimits.targetBytes, lessThan(ReceiptLimits.maxBytes));
      expect(ReceiptLimits.maxBytes, lessThan(1024 * 1024)); // Firestore's document cap
    });

    test('the image is native bytes (a Blob), never base64 or a URL', () {
      final receipt = smallReceipt();
      final map = OrderReceiptModel.toFirestoreCreateMap(
        orderId: 'o1',
        customerId: 'cust1',
        companyId: 'c1',
        image: receipt,
      );
      expect(map['image'], isA<Blob>());
      expect((map['image'] as Blob).bytes, receipt.bytes);
      expect(map['sizeBytes'], receipt.bytes.length);
      expect(map['contentType'], 'image/jpeg');
      expect(map['createdAt'], isA<FieldValue>()); // the server clock
      expect(map.values.whereType<String>().any((v) => v.startsWith('http')), isFalse);
    });

    test('a stored receipt is read back, and bad data reads as "none"', () {
      final receipt = smallReceipt();
      final read = OrderReceiptModel.fromMap('o1', {
        'orderId': 'o1',
        'customerId': 'cust1',
        'companyId': 'c1',
        'fileName': 'slip.jpg',
        'image': Blob(receipt.bytes),
        'width': 200,
        'height': 300,
      })!;
      expect(read.image.bytes, receipt.bytes);
      expect((read.orderId, read.customerId, read.companyId), ('o1', 'cust1', 'c1'));
      expect(OrderReceiptModel.fromMap('o1', null), isNull);
      expect(OrderReceiptModel.fromMap('o1', {'image': 'AAAA', 'width': 1, 'height': 1}), isNull);
      expect(OrderReceiptModel.fromMap('o1', {'image': Blob(Uint8List(1))}), isNull);
    });
  });

  // ------------------------------------------------------------------ repository
  group('the order and its receipt travel together', () {
    test('placing an order passes the receipt on and records its name on the order', () async {
      final remote = FakeOrdersRemote();
      final receipt = smallReceipt(fileName: 'bankak.jpg');
      final order = await OrdersRepositoryImpl(remote).createOrder(
        orderId: 'o1',
        customerId: 'cust1',
        companyId: 'c1',
        productId: 'p1',
        productName: 'Router',
        quantity: 1,
        unitPrice: 1000,
        productSubtotal: 1000,
        installationSelected: false,
        installationFee: 0,
        deliveryFee: 0,
        totalAmount: 1000,
        deliveryAddress: 'Khartoum',
        contactPhone: '0912345678',
        receipt: receipt,
      );
      expect(remote.createdReceipts.single, same(receipt));
      expect(remote.createdOrders.single.receiptFileName, 'bankak.jpg');
      expect(order.receiptFileName, 'bankak.jpg');
    });

    test('an order can still be placed without an image (unchanged behaviour)', () async {
      final remote = FakeOrdersRemote();
      await OrdersRepositoryImpl(remote).createOrder(
        orderId: 'o2',
        customerId: 'cust1',
        companyId: 'c1',
        productId: 'p1',
        productName: 'Router',
        quantity: 1,
        unitPrice: 1000,
        productSubtotal: 1000,
        installationSelected: false,
        installationFee: 0,
        deliveryFee: 0,
        totalAmount: 1000,
        deliveryAddress: 'Khartoum',
        contactPhone: '0912345678',
        receiptFileName: 'legacy.jpg',
      );
      expect(remote.createdReceipts.single, isNull);
      expect(remote.createdOrders.single.receiptFileName, 'legacy.jpg');
    });

    test('reading a receipt is delegated to the data source', () async {
      final remote = FakeOrdersRemote()..storedReceipt = null;
      expect(await OrdersRepositoryImpl(remote).getReceipt('o9'), isNull);
      expect(remote.receiptReads, ['o9']);
    });
  });

  // ------------------------------------------------------------ payment screen
  group('the payment screen: real picking, compression and submission', () {
    Future<void> openPicker(WidgetTester tester) async {
      final trigger = find.textContaining(_en.paymentTapToUpload);
      await tester.ensureVisible(trigger);
      await tester.tap(trigger);
      await tester.pumpAndSettle();
    }

    Future<void> choose(WidgetTester tester, String label) async {
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
    }

    testWidgets('choosing from the device shows the real image and its size',
        (tester) async {
      final remote = FakeOrdersRemote();
      final picker = FakePicker(file: _file());
      final compressor = FakeCompressor(result: smallReceipt(fileName: 'slip.jpg'));
      await tester.pumpWidget(
        _app(const ManualPaymentScreen(draft: _draft), remote, picker: picker, compressor: compressor),
      );
      await tester.pumpAndSettle();

      await openPicker(tester);
      expect(find.text(_en.imageChooseFromDevice), findsOneWidget);
      expect(find.text(_en.imageTakePhoto), findsOneWidget);
      await choose(tester, _en.imageChooseFromDevice);

      expect(picker.sources, [ReceiptSource.gallery]);
      expect(compressor.calls, 1);
      expect(find.byKey(const ValueKey('receipt-preview')), findsOneWidget);
      final kb = (smallReceipt().sizeBytes / 1024).round();
      expect(find.text('slip.jpg ($kb KB)'), findsOneWidget);
      // the old invented "transfer slip" is gone: only the customer's own image is shown
      expect(find.textContaining('COMPLETED'), findsNothing);
      expect(find.textContaining('SLIP'), findsNothing);
      expect(find.textContaining('Beneficiary'), findsNothing);
      expect(find.textContaining('Sudan ICT Marketplace'), findsNothing);
    });

    testWidgets('the camera option uses the camera', (tester) async {
      final picker = FakePicker(file: _file());
      await tester.pumpWidget(
        _app(
          const ManualPaymentScreen(draft: _draft),
          FakeOrdersRemote(),
          picker: picker,
          compressor: FakeCompressor(),
        ),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      await choose(tester, _en.imageTakePhoto);
      expect(picker.sources, [ReceiptSource.camera]);
      expect(find.byKey(const ValueKey('receipt-preview')), findsOneWidget);
    });

    testWidgets('dismissing the picker leaves the screen unchanged', (tester) async {
      final picker = FakePicker(); // returns null = dismissed
      final compressor = FakeCompressor();
      await tester.pumpWidget(
        _app(const ManualPaymentScreen(draft: _draft), FakeOrdersRemote(), picker: picker, compressor: compressor),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      await choose(tester, _en.imageChooseFromDevice);
      expect(compressor.calls, 0);
      expect(find.byKey(const ValueKey('receipt-preview')), findsNothing);
      expect(find.textContaining(_en.paymentTapToUpload), findsOneWidget);
    });

    testWidgets('while the image is being prepared the screen says so and cannot submit',
        (tester) async {
      final gate = Completer<void>();
      final compressor = FakeCompressor(gate: gate);
      await tester.pumpWidget(
        _app(
          const ManualPaymentScreen(draft: _draft),
          FakeOrdersRemote(),
          picker: FakePicker(file: _file()),
          compressor: compressor,
        ),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      await tester.tap(find.text(_en.imageChooseFromDevice));
      await tester.pump();
      await tester.pump();

      expect(find.text(_en.receiptPreparing), findsOneWidget);
      final submit = find.widgetWithText(FilledButton, _en.paymentSubmit);
      await tester.ensureVisible(submit);
      expect(tester.widget<FilledButton>(submit).onPressed, isNull);

      gate.complete();
      await tester.pumpAndSettle();
      expect(find.text(_en.receiptPreparing), findsNothing);
      expect(find.byKey(const ValueKey('receipt-preview')), findsOneWidget);
    });

    for (final (failure, message) in <(ReceiptPickFailure, String)>[
      (ReceiptPickFailure.cameraDenied, _en.imageCameraDenied),
      (ReceiptPickFailure.galleryDenied, _en.imageGalleryDenied),
      (ReceiptPickFailure.cameraUnavailable, _en.imageCameraUnavailable),
      (ReceiptPickFailure.unsupported, _en.imageUnsupported),
      (ReceiptPickFailure.tooLarge, _en.receiptTooLarge),
      (ReceiptPickFailure.failed, _en.imagePickFailed),
    ]) {
      testWidgets('a "$failure" pick failure shows its message and no image', (tester) async {
        await tester.pumpWidget(
          _app(
            const ManualPaymentScreen(draft: _draft),
            FakeOrdersRemote(),
            picker: FakePicker(failure: failure),
            compressor: FakeCompressor(),
          ),
        );
        await tester.pumpAndSettle();
        await openPicker(tester);
        await choose(tester, _en.imageChooseFromDevice);
        expect(find.text(message), findsOneWidget);
        expect(find.byKey(const ValueKey('receipt-preview')), findsNothing);
      });
    }

    for (final (error, message) in <(ReceiptCompressionError, String)>[
      (ReceiptCompressionError.unreadable, _en.receiptUnreadable),
      (ReceiptCompressionError.tooLarge, _en.receiptTooLarge),
    ]) {
      testWidgets('a "$error" compression failure shows its message', (tester) async {
        await tester.pumpWidget(
          _app(
            const ManualPaymentScreen(draft: _draft),
            FakeOrdersRemote(),
            picker: FakePicker(file: _file()),
            compressor: FakeCompressor(error: error),
          ),
        );
        await tester.pumpAndSettle();
        await openPicker(tester);
        await choose(tester, _en.imageChooseFromDevice);
        expect(find.text(message), findsOneWidget);
        expect(find.byKey(const ValueKey('receipt-preview')), findsNothing);
        expect(find.textContaining(_en.paymentTapToUpload), findsOneWidget); // can try again
      });
    }

    testWidgets('without a receipt the order is not placed', (tester) async {
      final remote = FakeOrdersRemote();
      await tester.pumpWidget(_app(const ManualPaymentScreen(draft: _draft), remote));
      await tester.pumpAndSettle();
      final submit = find.widgetWithText(FilledButton, _en.paymentSubmit);
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(find.text(_en.paymentReceiptRequired), findsOneWidget);
      expect(remote.createdOrders, isEmpty);
    });

    testWidgets('submitting stores the order together with the compressed receipt',
        (tester) async {
      final remote = FakeOrdersRemote();
      final receipt = smallReceipt(fileName: 'slip.jpg');
      await tester.pumpWidget(
        _app(
          const ManualPaymentScreen(draft: _draft),
          remote,
          picker: FakePicker(file: _file()),
          compressor: FakeCompressor(result: receipt),
        ),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      await choose(tester, _en.imageChooseFromDevice);

      final submit = find.widgetWithText(FilledButton, _en.paymentSubmit);
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();

      expect(remote.createdOrders, hasLength(1));
      expect(remote.createdOrders.single.id, 'o1'); // the draft's own order id
      expect(remote.createdOrders.single.receiptFileName, 'slip.jpg');
      final stored = remote.createdReceipts.single!;
      expect(stored.bytes, receipt.bytes);
      expect(isJpeg(stored.bytes), isTrue);
      expect(find.byType(OrderPendingVerificationScreen), findsOneWidget);
    });

    testWidgets('a failed order keeps the receipt so the customer can retry',
        (tester) async {
      final remote = FakeOrdersRemote()
        ..createError = const AppException(AppErrorCode.orderCreateNetwork);
      await tester.pumpWidget(
        _app(
          const ManualPaymentScreen(draft: _draft),
          remote,
          picker: FakePicker(file: _file()),
          compressor: FakeCompressor(),
        ),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      await choose(tester, _en.imageChooseFromDevice);
      final submit = find.widgetWithText(FilledButton, _en.paymentSubmit);
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();

      expect(find.byType(OrderPendingVerificationScreen), findsNothing);
      expect(find.byKey(const ValueKey('receipt-preview')), findsOneWidget);
      expect(find.text(_en.orderCreateNetwork), findsOneWidget);
      // let the error message leave the screen, then try again
      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle();
      remote.createError = null;
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(remote.createdOrders, hasLength(1));
      expect(remote.createdReceipts.single, isNotNull);
      expect(find.byType(OrderPendingVerificationScreen), findsOneWidget);
    });

    testWidgets('removing the receipt brings back the upload box', (tester) async {
      await tester.pumpWidget(
        _app(
          const ManualPaymentScreen(draft: _draft),
          FakeOrdersRemote(),
          picker: FakePicker(file: _file()),
          compressor: FakeCompressor(),
        ),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      await choose(tester, _en.imageChooseFromDevice);
      await tester.ensureVisible(find.text(_en.commonRemove));
      await tester.tap(find.text(_en.commonRemove));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('receipt-preview')), findsNothing);
      expect(find.textContaining(_en.paymentTapToUpload), findsOneWidget);
    });

    testWidgets('the whole chain works with the REAL compressor', (tester) async {
      final remote = FakeOrdersRemote();
      await tester.pumpWidget(
        _app(
          const ManualPaymentScreen(draft: _draft),
          remote,
          picker: FakePicker(file: PickedReceiptFile(name: 'shot.png', bytes: png(receiptLikeImage()))),
        ),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      await tester.tap(find.text(_en.imageChooseFromDevice));
      // the image work runs in a real isolate: give it real time
      for (var i = 0; i < 60 && find.byKey(const ValueKey('receipt-preview')).evaluate().isEmpty; i++) {
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
        await tester.pump();
      }
      expect(find.byKey(const ValueKey('receipt-preview')), findsOneWidget);

      final submit = find.widgetWithText(FilledButton, _en.paymentSubmit);
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      final stored = remote.createdReceipts.single!;
      expect(isJpeg(stored.bytes), isTrue);
      expect(stored.bytes.length, lessThanOrEqualTo(ReceiptLimits.targetBytes));
      expect(stored.fileName, 'shot.jpg');
    });

    testWidgets('a HEIC-named photo (JPEG bytes) is accepted and stored as a .jpg', (tester) async {
      final remote = FakeOrdersRemote();
      await tester.pumpWidget(
        _app(
          const ManualPaymentScreen(draft: _draft),
          remote,
          picker: FakePicker(
            file: PickedReceiptFile(
              name: 'scaled_IMG_0001.heic',
              bytes: jpg(receiptLikeImage(width: 600, height: 800)),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      await tester.tap(find.text(_en.imageChooseFromDevice));
      for (var i = 0; i < 60 && find.byKey(const ValueKey('receipt-preview')).evaluate().isEmpty; i++) {
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
        await tester.pump();
      }
      expect(find.byKey(const ValueKey('receipt-preview')), findsOneWidget);
      expect(find.text(_en.imageUnsupported), findsNothing);
      expect(find.text(_en.receiptUnreadable), findsNothing);

      final submit = find.widgetWithText(FilledButton, _en.paymentSubmit);
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      final stored = remote.createdReceipts.single!;
      expect(isJpeg(stored.bytes), isTrue);
      expect(stored.fileName, 'scaled_IMG_0001.jpg');
      expect(remote.createdOrders.single.receiptFileName, 'scaled_IMG_0001.jpg');
    });

    for (final (name, bytes) in <(String, Uint8List)>[
      ('receipt.jpg', Uint8List.fromList('%PDF-1.7 not an image'.codeUnits)),
      ('IMG_9.heic', Uint8List.fromList([0, 0, 0, 24, ...'ftypheic'.codeUnits, ...List<int>.filled(100, 9)])),
      ('cut.jpg', Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 0, 16])),
    ]) {
      testWidgets('"$name" that cannot be decoded is refused safely: message, no image, no order',
          (tester) async {
        final remote = FakeOrdersRemote();
        await tester.pumpWidget(
          _app(
            const ManualPaymentScreen(draft: _draft),
            remote,
            picker: FakePicker(file: PickedReceiptFile(name: name, bytes: bytes)),
          ),
        );
        await tester.pumpAndSettle();
        await openPicker(tester);
        await tester.tap(find.text(_en.imageChooseFromDevice));
        for (var i = 0; i < 60 && find.text(_en.receiptUnreadable).evaluate().isEmpty; i++) {
          await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
          await tester.pump();
        }
        expect(find.text(_en.receiptUnreadable), findsOneWidget);
        expect(find.byKey(const ValueKey('receipt-preview')), findsNothing);
        expect(find.textContaining(_en.paymentTapToUpload), findsOneWidget); // can pick again

        final submit = find.widgetWithText(FilledButton, _en.paymentSubmit);
        await tester.ensureVisible(submit);
        await tester.tap(submit);
        await tester.pumpAndSettle();
        expect(find.text(_en.paymentReceiptRequired), findsOneWidget);
        expect(remote.createdOrders, isEmpty);
        expect(remote.createdReceipts, isEmpty);
      });
    }

    testWidgets('Arabic: right-to-left with translated messages', (tester) async {
      final gate = Completer<void>();
      await tester.pumpWidget(
        _app(
          const ManualPaymentScreen(draft: _draft),
          FakeOrdersRemote(),
          picker: FakePicker(file: _file()),
          compressor: FakeCompressor(gate: gate),
          locale: const Locale('ar'),
        ),
      );
      await tester.pumpAndSettle();
      final trigger = find.textContaining(_ar.paymentTapToUpload);
      await tester.ensureVisible(trigger);
      await tester.tap(trigger);
      await tester.pumpAndSettle();
      await tester.tap(find.text(_ar.imageChooseFromDevice));
      await tester.pump();
      await tester.pump();
      expect(find.text(_ar.receiptPreparing), findsOneWidget);
      expect(Directionality.of(tester.element(find.byType(Scaffold).first)), TextDirection.rtl);
      gate.complete();
      await tester.pumpAndSettle();
    });
  });

  // ---------------------------------------------------------------- viewing
  group('viewing a receipt', () {
    OrderReceipt stored() => OrderReceipt(
          orderId: 'o1',
          customerId: 'cust1',
          companyId: 'c1',
          image: smallReceipt(fileName: 'slip.jpg'),
        );

    testWidgets('shows the stored image with its name and size', (tester) async {
      final remote = FakeOrdersRemote()..storedReceipt = stored();
      await tester.pumpWidget(_app(const ReceiptViewerScreen(orderId: 'o1'), remote));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('receipt-image')), findsOneWidget);
      expect(find.byType(InteractiveViewer), findsOneWidget); // pinch-zoom
      final kb = (smallReceipt().sizeBytes / 1024).round();
      expect(find.text('slip.jpg · $kb KB'), findsOneWidget);
      expect(remote.receiptReads, ['o1']);
    });

    testWidgets('an order without a stored image (placed before this feature) says so',
        (tester) async {
      final remote = FakeOrdersRemote(); // no receipt document
      await tester.pumpWidget(_app(const ReceiptViewerScreen(orderId: 'legacy'), remote));
      await tester.pumpAndSettle();
      expect(find.text(_en.receiptNone), findsOneWidget);
      expect(find.byKey(const ValueKey('receipt-image')), findsNothing);
      expect(find.text(_en.receiptLoadFailed), findsNothing);
    });

    testWidgets('shows a spinner while loading', (tester) async {
      final remote = FakeOrdersRemote()
        ..storedReceipt = stored()
        ..receiptGate = Completer<void>();
      await tester.pumpWidget(_app(const ReceiptViewerScreen(orderId: 'o1'), remote));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsWidgets);
      remote.receiptGate!.complete();
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('receipt-image')), findsOneWidget);
    });

    testWidgets('a failed load shows a message and can be retried', (tester) async {
      final remote = FakeOrdersRemote()
        ..storedReceipt = stored()
        ..receiptError = const AppException(AppErrorCode.orderReceiptLoadFailed);
      await tester.pumpWidget(_app(const ReceiptViewerScreen(orderId: 'o1'), remote));
      await tester.pumpAndSettle();
      expect(find.text(_en.receiptLoadFailed), findsOneWidget);

      remote.receiptError = null;
      await tester.tap(find.text(_en.commonRetry));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('receipt-image')), findsOneWidget);
      expect(remote.receiptReads, hasLength(2));
    });

    testWidgets('the customer order screen offers it, and only loads it when asked',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final remote = FakeOrdersRemote()..storedReceipt = stored();
      await tester.pumpWidget(_app(OrderDetailsScreen(order: _order()), remote));
      await tester.pumpAndSettle();

      expect(remote.receiptReads, isEmpty); // not fetched with the order screen
      await tester.ensureVisible(find.text(_en.receiptView));
      await tester.tap(find.text(_en.receiptView));
      await tester.pumpAndSettle();
      expect(find.byType(ReceiptViewerScreen), findsOneWidget);
      expect(find.byKey(const ValueKey('receipt-image')), findsOneWidget);
      expect(remote.receiptReads, ['o1']);
    });

    testWidgets('an order with no receipt marker has no receipt button', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        _app(OrderDetailsScreen(order: _order(receiptFileName: null)), FakeOrdersRemote()),
      );
      await tester.pumpAndSettle();
      expect(find.text(_en.receiptView), findsNothing);
    });

    test('technician screens never touch receipts', () {
      final offenders = <String>[];
      for (final entity in Directory('lib/features/technician').listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        final text = entity.readAsStringSync();
        if (text.contains('receipt_viewer') ||
            text.contains('orderReceiptProvider') ||
            text.contains('OrderReceipt') ||
            text.contains('order_receipts')) {
          offenders.add(entity.path);
        }
      }
      expect(offenders, isEmpty);
    });

    test('order lists never carry receipt bytes (the image is separate from the order)', () {
      final entity = File('lib/features/orders/domain/entities/order_entity.dart').readAsStringSync();
      final model = File('lib/features/orders/data/models/order_model.dart').readAsStringSync();
      for (final source in [entity, model]) {
        expect(source, isNot(contains('Blob')));
        expect(source, isNot(contains('Uint8List')));
        expect(source, isNot(contains('order_receipts')));
      }
    });
  });
}

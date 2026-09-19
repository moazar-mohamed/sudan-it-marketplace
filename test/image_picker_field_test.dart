import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/services/image_upload_service.dart';
import 'package:sudan_it_marketplace/core/widgets/image_picker_field.dart';

Widget _app(ImagePickerController controller, {Locale locale = const Locale('en')}) {
  return MaterialApp(
    locale: locale,
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: const [Locale('en'), Locale('ar')],
    home: Scaffold(
      body: SingleChildScrollView(
        child: ImagePickerField(controller: controller),
      ),
    ),
  );
}

void main() {
  group('ImageRules', () {
    test('accepts http(s) links with a host only', () {
      expect(ImageRules.isValidImageUrl('https://example.com/a.jpg'), isTrue);
      expect(ImageRules.isValidImageUrl(' http://example.com/a.png '), isTrue);
      expect(ImageRules.isValidImageUrl(''), isFalse);
      expect(ImageRules.isValidImageUrl('example.com/a.jpg'), isFalse);
      expect(ImageRules.isValidImageUrl('ftp://example.com/a.jpg'), isFalse);
      expect(ImageRules.isValidImageUrl('https://'), isFalse);
    });

    test('recognises supported image files only', () {
      expect(ImageRules.contentTypeForName('photo.JPG'), 'image/jpeg');
      expect(ImageRules.contentTypeForName('logo.png'), 'image/png');
      expect(ImageRules.contentTypeForName('doc.pdf'), isNull);
      expect(ImageRules.contentTypeForName('noextension'), isNull);
      expect(ImageRules.contentTypeForMime('image/webp'), 'image/webp');
      expect(ImageRules.contentTypeForMime('text/plain'), isNull);
      expect(ImageRules.contentTypeForMime(null), isNull);
    });
  });

  group('ImagePickerController', () {
    test('keeps an existing URL and leaves it alone on save', () async {
      final controller = ImagePickerController(url: ' https://x.test/a.jpg ');
      expect(controller.hasImage, isTrue);
      final resolved = await controller.resolveUrl(
        _NeverUploads(),
        folder: 'product-images/c1',
      );
      expect(resolved, 'https://x.test/a.jpg');
    });

    test('uploads a picked image once and then holds its URL', () async {
      final service = _FakeUpload('https://storage.test/new.jpg');
      final controller = ImagePickerController(url: 'https://x.test/old.jpg')
        ..setPicked(
          PickedImage(bytes: Uint8List.fromList([1, 2, 3]), contentType: 'image/jpeg'),
        );
      expect(controller.url, 'https://x.test/old.jpg');

      expect(
        await controller.resolveUrl(service, folder: 'company-logos/c1'),
        'https://storage.test/new.jpg',
      );
      expect(service.folders, ['company-logos/c1']);
      expect(controller.picked, isNull);

      // A retry after a failed Firestore save must not upload again.
      await controller.resolveUrl(service, folder: 'company-logos/c1');
      expect(service.folders, hasLength(1));
    });

    test('a failed upload keeps the picked image so save can be retried', () async {
      final controller = ImagePickerController()
        ..setPicked(
          PickedImage(bytes: Uint8List.fromList([1]), contentType: 'image/png'),
        );
      await expectLater(
        controller.resolveUrl(_FailingUpload(), folder: 'x'),
        throwsA(isA<ImageUploadException>()),
      );
      expect(controller.picked, isNotNull);
      expect(controller.isUploading, isFalse);
    });
  });

  group('ImagePickerField', () {
    testWidgets('empty state shows one Add Image button, options open on tap',
        (tester) async {
      final controller = ImagePickerController();
      await tester.pumpWidget(_app(controller));

      expect(find.text('Add Image'), findsOneWidget);
      expect(find.text('Choose from device'), findsNothing);
      expect(find.text('Use image URL'), findsNothing);

      await tester.tap(find.text('Add Image'));
      await tester.pumpAndSettle();

      expect(find.text('Choose from device'), findsOneWidget);
      expect(find.text('Take a photo'), findsOneWidget);
      expect(find.text('Use image URL'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);

      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(controller.hasImage, isFalse);
    });

    testWidgets('URL option validates, previews, and Change Image reopens options',
        (tester) async {
      final controller = ImagePickerController();
      await tester.pumpWidget(_app(controller));

      await tester.tap(find.text('Add Image'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Use image URL'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Done'));
      await tester.pump();
      expect(find.text('Enter the image URL.'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'not a url');
      await tester.tap(find.text('Done'));
      await tester.pump();
      expect(find.text('Enter a valid image link (http/https).'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'https://x.test/a.jpg');
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();

      expect(controller.url, 'https://x.test/a.jpg');
      expect(find.text('Add Image'), findsNothing);
      expect(find.text('Change Image'), findsOneWidget);

      await tester.tap(find.text('Change Image'));
      await tester.pumpAndSettle();
      expect(find.text('Choose from device'), findsOneWidget);
      expect(find.text('Take a photo'), findsOneWidget);
      expect(find.text('Use image URL'), findsOneWidget);
    });

    testWidgets('Remove clears the image and returns to Add Image', (tester) async {
      final controller = ImagePickerController(url: 'https://x.test/a.jpg');
      await tester.pumpWidget(_app(controller));

      expect(find.text('Change Image'), findsOneWidget);
      await tester.tap(find.text('Remove'));
      await tester.pumpAndSettle();

      expect(controller.hasImage, isFalse);
      expect(find.text('Add Image'), findsOneWidget);
    });

    testWidgets('renders Arabic labels in RTL', (tester) async {
      final controller = ImagePickerController();
      await tester.pumpWidget(_app(controller, locale: const Locale('ar')));

      expect(find.text('الصورة'), findsOneWidget);
      expect(find.text('إضافة صورة'), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.text('إضافة صورة'))),
        TextDirection.rtl,
      );

      await tester.tap(find.text('إضافة صورة'));
      await tester.pumpAndSettle();
      expect(find.text('اختيار من الجهاز'), findsOneWidget);
      expect(find.text('التقاط صورة'), findsOneWidget);
      expect(find.text('استخدام رابط صورة'), findsOneWidget);
      expect(find.text('إلغاء'), findsOneWidget);
    });
  });
}

class _NeverUploads implements ImageUploadService {
  @override
  Future<String> upload(PickedImage image, {required String folder}) =>
      throw StateError('should not upload');
}

class _FakeUpload implements ImageUploadService {
  _FakeUpload(this.url);
  final String url;
  final folders = <String>[];

  @override
  Future<String> upload(PickedImage image, {required String folder}) async {
    folders.add(folder);
    return url;
  }
}

class _FailingUpload implements ImageUploadService {
  @override
  Future<String> upload(PickedImage image, {required String folder}) =>
      throw const ImageUploadException('unauthorized');
}

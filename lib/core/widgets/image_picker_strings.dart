import 'package:flutter/widgets.dart';

/// English / Arabic text for the shared image picker. Follows the active
/// locale of the [MaterialApp], like the location feature's strings.
class ImagePickerStrings {
  const ImagePickerStrings._(this._ar);

  factory ImagePickerStrings.of(BuildContext context) => ImagePickerStrings._(
        Localizations.localeOf(context).languageCode == 'ar',
      );

  final bool _ar;

  String _t(String en, String ar) => _ar ? ar : en;

  String get image => _t('Image', 'الصورة');
  String get addImage => _t('Add Image', 'إضافة صورة');
  String get changeImage => _t('Change Image', 'تغيير الصورة');
  String get removeImage => _t('Remove', 'إزالة');
  String get chooseFromDevice => _t('Choose from device', 'اختيار من الجهاز');
  String get takePhoto => _t('Take a photo', 'التقاط صورة');
  String get useImageUrl => _t('Use image URL', 'استخدام رابط صورة');
  String get imageUrl => _t('Image URL', 'رابط الصورة');
  String get cancel => _t('Cancel', 'إلغاء');
  String get done => _t('Done', 'تم');
  String get uploading => _t('Uploading image', 'جارٍ رفع الصورة');
  String get uploadFailed => _t('Failed to upload image', 'فشل رفع الصورة');
  String get emptyUrl => _t('Enter the image URL.', 'أدخل رابط الصورة.');
  String get invalidUrl => _t(
        'Enter a valid image link (http/https).',
        'أدخل رابط صورة صالحًا (http/https).',
      );
  String get unsupportedFile => _t(
        'Unsupported image. Use a JPG, PNG, WebP or GIF file.',
        'صورة غير مدعومة. استخدم ملف JPG أو PNG أو WebP أو GIF.',
      );
  String get fileTooLarge => _t(
        'This image is too large. The maximum size is 5 MB.',
        'حجم الصورة كبير جدًا. الحد الأقصى 5 ميغابايت.',
      );
  String get cameraDenied => _t(
        'Camera permission was denied. Allow camera access in settings to take a photo.',
        'تم رفض إذن الكاميرا. اسمح بالوصول إلى الكاميرا من الإعدادات لالتقاط صورة.',
      );
  String get galleryDenied => _t(
        'Photo access was denied. Allow photo access in settings to choose an image.',
        'تم رفض إذن الصور. اسمح بالوصول إلى الصور من الإعدادات لاختيار صورة.',
      );
  String get cameraUnavailable => _t(
        'The camera is not available on this device.',
        'الكاميرا غير متاحة على هذا الجهاز.',
      );
  String get pickFailed => _t(
        'Could not open the image. Please try again.',
        'تعذر فتح الصورة. حاول مرة أخرى.',
      );
}

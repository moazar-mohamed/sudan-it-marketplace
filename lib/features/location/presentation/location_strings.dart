import 'package:flutter/widgets.dart';

/// English / Arabic text for the location feature. The app has no global
/// localization layer yet, so this follows the active locale of the
/// [MaterialApp] (device language) and keeps RTL/LTR handling to Flutter.
class LocationStrings {
  const LocationStrings._(this._ar);

  factory LocationStrings.of(BuildContext context) =>
      LocationStrings._(Localizations.localeOf(context).languageCode == 'ar');

  final bool _ar;

  String _t(String en, String ar) => _ar ? ar : en;

  String get location => _t('Location', 'الموقع');
  String get enterAddress => _t('Enter address', 'أدخل العنوان');
  String get or => _t('OR', 'أو');
  String get selectOnMap => _t('Select on Map', 'تحديد من الخريطة');
  String get useMyCurrentLocation =>
      _t('Use My Current Location', 'استخدام موقعي الحالي');
  String get confirmLocation => _t('Confirm Location', 'تأكيد الموقع');
  String get changeLocation => _t('Change Location', 'تغيير الموقع');
  String get removeMapLocation =>
      _t('Remove map location', 'إزالة موقع الخريطة');
  String get viewOnMap => _t('View on Map', 'عرض على الخريطة');
  String get openOrderLocation => _t('Open Order Location', 'فتح موقع الطلب');
  String get openCompanyLocation =>
      _t('Open Company Location', 'فتح موقع الشركة');
  String get viewCompanyLocation =>
      _t('View Company Location', 'عرض موقع الشركة');
  String get openDeliveryLocation =>
      _t('Open Delivery Location', 'فتح موقع التوصيل');
  String get searchAddressOnMap =>
      _t('Search Address on Map', 'البحث عن العنوان في الخريطة');
  String get openInMapsApp => _t('Open in Maps app', 'فتح في تطبيق الخرائط');
  String get locationSelected => _t('Location selected', 'تم تحديد الموقع');
  String get latitudeShort => _t('Lat', 'خط العرض');
  String get longitudeShort => _t('Lng', 'خط الطول');
  String get tapToSelect => _t(
    'Tap the map to choose the exact point. Tap again to move it.',
    'اضغط على الخريطة لتحديد النقطة بدقة. اضغط مرة أخرى لتحريكها.',
  );
  String get pinnedOnMap => _t('Pinned on map', 'محدد على الخريطة');
  String get addressApproximate => _t(
    'Written address only (no exact map point)',
    'عنوان مكتوب فقط (بدون نقطة دقيقة على الخريطة)',
  );
  String get locationRequired => _t(
    'Enter an address or select a location on the map.',
    'أدخل العنوان أو حدد الموقع من الخريطة.',
  );
  String get couldNotOpenMaps =>
      _t('Could not open the maps app.', 'تعذر فتح تطبيق الخرائط.');
  String get locationServiceOff => _t(
    'Location services are turned off. You can still tap the map.',
    'خدمات الموقع متوقفة. يمكنك الضغط على الخريطة لتحديد الموقع.',
  );
  String get permissionDenied => _t(
    'Location permission was denied. You can still tap the map or type an address.',
    'تم رفض إذن الموقع. يمكنك الضغط على الخريطة أو كتابة العنوان.',
  );
  String get permissionDeniedForever => _t(
    'Location permission is blocked in settings. You can still tap the map.',
    'إذن الموقع محظور من الإعدادات. يمكنك الضغط على الخريطة.',
  );
  String get currentLocationUnavailable => _t(
    'Could not get your current location. You can still tap the map.',
    'تعذر الحصول على موقعك الحالي. يمكنك الضغط على الخريطة.',
  );
}

import 'package:flutter/widgets.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../l10n/app_localizations.dart';

/// Text for the location feature, in the active language. A thin facade over
/// the app's ARB translations; direction (RTL/LTR) is handled by Flutter from
/// the same locale.
class LocationStrings {
  const LocationStrings._(this._l);

  factory LocationStrings.of(BuildContext context) =>
      LocationStrings._(context.l10n);

  final AppLocalizations _l;

  String get location => _l.locationTitle;
  String get enterAddress => _l.locationEnterAddress;
  String get or => _l.commonOr;
  String get selectOnMap => _l.locationSelectOnMap;
  String get useMyCurrentLocation => _l.locationUseCurrent;
  String get confirmLocation => _l.locationConfirm;
  String get changeLocation => _l.locationChange;
  String get removeMapLocation => _l.locationRemoveMap;
  String get viewOnMap => _l.locationViewOnMap;
  String get openOrderLocation => _l.locationOpenOrder;
  String get openCompanyLocation => _l.locationOpenCompany;
  String get viewCompanyLocation => _l.locationViewCompany;
  String get openDeliveryLocation => _l.locationOpenDelivery;
  String get searchAddressOnMap => _l.locationSearchAddress;
  String get openInMapsApp => _l.locationOpenInMaps;
  String get locationSelected => _l.locationSelected;
  String get latitudeShort => _l.locationLatShort;
  String get longitudeShort => _l.locationLngShort;
  String get tapToSelect => _l.locationTapToSelect;
  String get pinnedOnMap => _l.locationPinned;
  String get addressApproximate => _l.locationAddressApproximate;
  String get locationRequired => _l.locationRequired;
  String get couldNotOpenMaps => _l.locationCouldNotOpenMaps;
  String get locationServiceOff => _l.locationServiceOff;
  String get permissionDenied => _l.locationPermissionDenied;
  String get permissionDeniedForever => _l.locationPermissionDeniedForever;
  String get currentLocationUnavailable => _l.locationCurrentUnavailable;
}

import 'package:flutter/widgets.dart';

import '../../l10n/app_localizations.dart';
import '../localization/l10n_extension.dart';

/// Text for the shared image picker, in the active language. A thin facade
/// over the app's ARB translations, kept so the picker's call sites read the
/// same as before.
class ImagePickerStrings {
  const ImagePickerStrings._(this._l);

  factory ImagePickerStrings.of(BuildContext context) =>
      ImagePickerStrings._(context.l10n);

  final AppLocalizations _l;

  String get image => _l.imageLabel;
  String get addImage => _l.imageAdd;
  String get changeImage => _l.imageChange;
  String get removeImage => _l.commonRemove;
  String get chooseFromDevice => _l.imageChooseFromDevice;
  String get takePhoto => _l.imageTakePhoto;
  String get useImageUrl => _l.imageUseUrl;
  String get imageUrl => _l.imageUrl;
  String get cancel => _l.commonCancel;
  String get done => _l.commonDone;
  String get uploading => _l.imageUploading;
  String get uploadFailed => _l.imageUploadFailed;
  String get emptyUrl => _l.imageEmptyUrl;
  String get invalidUrl => _l.imageInvalidUrl;
  String get unsupportedFile => _l.imageUnsupported;
  String get fileTooLarge => _l.imageTooLarge;
  String get cameraDenied => _l.imageCameraDenied;
  String get galleryDenied => _l.imageGalleryDenied;
  String get cameraUnavailable => _l.imageCameraUnavailable;
  String get pickFailed => _l.imagePickFailed;
}

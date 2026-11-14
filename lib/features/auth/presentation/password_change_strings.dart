import 'package:flutter/widgets.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../l10n/app_localizations.dart';

/// Text for the first-login password change, in the active language. A thin
/// facade over the app's ARB translations.
class PasswordChangeStrings {
  const PasswordChangeStrings._(this._l);

  factory PasswordChangeStrings.of(BuildContext context) =>
      PasswordChangeStrings._(context.l10n);

  /// The shortest password accepted (Firebase Authentication's own minimum).
  static const minLength = 6;

  final AppLocalizations _l;

  String get title => _l.passwordChangeTitle;
  String get intro => _l.passwordChangeIntro;
  String get currentPassword => _l.passwordChangeTemporary;
  String get newPassword => _l.passwordChangeNew;
  String get confirmPassword => _l.passwordChangeConfirm;
  String get submit => _l.passwordChangeSubmit;
  String get signOut => _l.commonSignOut;

  String get currentRequired => _l.passwordChangeCurrentRequired;
  String get newRequired => _l.passwordChangeNewRequired;
  String get tooShort => _l.passwordChangeTooShort(minLength);
  String get mismatch => _l.passwordChangeMismatch;
}

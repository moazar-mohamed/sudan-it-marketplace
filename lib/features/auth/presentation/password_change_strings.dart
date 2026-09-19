import 'package:flutter/widgets.dart';

/// English / Arabic text for the first-login password change. Follows the
/// active locale of the [MaterialApp], like the other feature strings.
class PasswordChangeStrings {
  const PasswordChangeStrings._(this._ar);

  factory PasswordChangeStrings.of(BuildContext context) =>
      PasswordChangeStrings._(
        Localizations.localeOf(context).languageCode == 'ar',
      );

  /// The shortest password accepted (Firebase Authentication's own minimum).
  static const minLength = 6;

  final bool _ar;

  String _t(String en, String ar) => _ar ? ar : en;

  String get title => _t('Choose a new password', 'اختر كلمة مرور جديدة');
  String get intro => _t(
        'You signed in with a temporary password. Choose your own password '
            'to continue.',
        'سجّلت الدخول بكلمة مرور مؤقتة. اختر كلمة مرورك الخاصة للمتابعة.',
      );
  String get currentPassword =>
      _t('Temporary password', 'كلمة المرور المؤقتة');
  String get newPassword => _t('New password', 'كلمة المرور الجديدة');
  String get confirmPassword =>
      _t('Confirm new password', 'تأكيد كلمة المرور الجديدة');
  String get submit => _t('Change password', 'تغيير كلمة المرور');
  String get signOut => _t('Sign out', 'تسجيل الخروج');

  String get currentRequired =>
      _t('Enter your temporary password.', 'أدخل كلمة المرور المؤقتة.');
  String get newRequired =>
      _t('Enter a new password.', 'أدخل كلمة مرور جديدة.');
  String get tooShort => _t(
        'The password must be at least $minLength characters.',
        'يجب ألا تقل كلمة المرور عن $minLength أحرف.',
      );
  String get mismatch =>
      _t('The passwords do not match.', 'كلمتا المرور غير متطابقتين.');
}

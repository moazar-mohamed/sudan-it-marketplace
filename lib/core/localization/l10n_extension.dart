import 'package:flutter/widgets.dart';

import '../../l10n/app_localizations.dart';
import 'app_locale.dart';

extension AppLocalizationsContext on BuildContext {
  /// The translations for the active language. Falls back to English when the
  /// localization delegates are not installed above this widget, so a widget
  /// can still be built in isolation (for example in a test).
  AppLocalizations get l10n =>
      Localizations.of<AppLocalizations>(this, AppLocalizations) ??
      lookupAppLocalizations(AppLocale.fallback);
}

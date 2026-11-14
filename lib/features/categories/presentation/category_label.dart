import 'package:flutter/widgets.dart';

import '../domain/entities/category.dart';

extension CategoryLabel on Category {
  /// The name in the language the screen is showing.
  String localizedName(BuildContext context) =>
      nameFor(Localizations.localeOf(context).languageCode);
}

import 'package:flutter/widgets.dart';

/// Text shown in place of a price when a company left the product's price out.
/// Follows the active locale of the [MaterialApp] (English / Arabic), like the
/// other feature strings.
class ProductPriceStrings {
  const ProductPriceStrings._();

  static String priceOnRequest(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'ar'
          ? 'السعر عند التواصل'
          : 'Price on request';
}

import 'package:flutter/widgets.dart';

import '../../../core/localization/l10n_extension.dart';

/// Text shown in place of a price when a company left the product's price out,
/// in the active language.
class ProductPriceStrings {
  const ProductPriceStrings._();

  static String priceOnRequest(BuildContext context) =>
      context.l10n.productPriceOnRequest;
}

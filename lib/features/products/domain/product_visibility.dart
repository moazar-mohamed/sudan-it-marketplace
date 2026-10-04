import 'entities/product.dart';

/// What a customer may see: the products Platform Admin has not hidden. A
/// hidden product stays in its own company's list (marked, with the reason)
/// and comes back the moment Platform Admin shows it again.
List<Product> withoutHiddenProducts(List<Product> products) => [
      for (final product in products)
        if (!product.hidden) product,
    ];

import 'entities/product.dart';

/// What a customer may see: the products Platform Admin has not hidden and
/// whose company has not taken them off sale (a draft or an archived product).
/// Both stay in their own company's list (marked) and come back the moment
/// they are shown or published again.
List<Product> withoutHiddenProducts(List<Product> products) => [
      for (final product in products)
        if (!product.hidden && product.isPublished) product,
    ];

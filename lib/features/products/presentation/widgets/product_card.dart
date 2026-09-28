import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../domain/entities/product.dart';
import '../product_details_screen.dart';
import 'product_offer_price.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.openedFromCompany = false,
    this.categoryName,
    this.highlight,
  });

  final Product product;
  final bool openedFromCompany;
  final String? categoryName;

  /// A search query whose matching words are marked in the name.
  final String? highlight;

  @override
  Widget build(BuildContext context) {
    final category = categoryName?.trim() ?? '';

    return AppListCard(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ProductDetailsScreen(
              product: product,
              openedFromCompany: openedFromCompany,
            ),
          ),
        );
      },
      leading: AppImageTile(imageUrl: product.imageUrl),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HighlightedText(
            product.name,
            query: highlight,
            style: AppTextStyles.bodyStrong,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (category.isNotEmpty)
            Text(
              category,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.captionStrong
                  .copyWith(color: context.colors.textBrand),
            ),
          const SizedBox(height: AppSpacing.s4),
          // A product without a price says so; it is never shown as 0.
          ProductOfferPrice(product: product, style: AppTextStyles.bodyStrong),
        ],
      ),
    );
  }
}

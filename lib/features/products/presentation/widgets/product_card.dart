import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../domain/entities/product.dart';
import '../product_details_screen.dart';
import '../product_price_strings.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.openedFromCompany = false,
    this.categoryName,
  });

  final Product product;
  final bool openedFromCompany;
  final String? categoryName;

  String _formatPrice(double price) {
    final parts = price.toStringAsFixed(0).split('.');
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return parts[0].replaceAllMapped(regExp, (Match m) => '${m[1]},');
  }

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
          Text(
            product.name,
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
                  .copyWith(color: AppColors.textBrand),
            ),
          const SizedBox(height: AppSpacing.s4),
          // A product without a price says so; it is never shown as 0.
          Text(
            product.price == null
                ? ProductPriceStrings.priceOnRequest(context)
                : '${_formatPrice(product.price!)} ${product.currency}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong.copyWith(
              color: product.price == null
                  ? AppColors.textSecondary
                  : AppColors.textBrand,
            ),
          ),
        ],
      ),
    );
  }
}

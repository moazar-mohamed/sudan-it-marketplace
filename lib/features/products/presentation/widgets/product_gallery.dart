import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/widgets/app_surfaces.dart';

/// The pictures of a product: one picture is shown as before; several can be
/// swiped, with dots below showing where you are. [overlay] sits on top of the
/// picture (the stock chip).
class ProductGallery extends StatefulWidget {
  const ProductGallery({
    super.key,
    required this.urls,
    this.overlay,
    this.height = 240,
  });

  final List<String> urls;
  final Widget? overlay;
  final double height;

  @override
  State<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends State<ProductGallery> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final urls = widget.urls;
    final colors = context.colors;
    final picture = urls.length <= 1
        ? AppImageTile(
            imageUrl: urls.isEmpty ? null : urls.first,
            size: widget.height,
            radius: AppRadius.lg,
            expand: true,
          )
        : SizedBox(
            height: widget.height,
            child: PageView.builder(
              key: const ValueKey('product-gallery'),
              itemCount: urls.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) => AppImageTile(
                imageUrl: urls[i],
                size: widget.height,
                radius: AppRadius.lg,
                expand: true,
              ),
            ),
          );
    return Column(
      children: [
        Stack(children: [picture, ?widget.overlay]),
        if (urls.length > 1) ...[
          const SizedBox(height: AppSpacing.s8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < urls.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 18 : 7,
                  height: 7,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    color: i == _page ? colors.brandPrimary : colors.borderDefault,
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

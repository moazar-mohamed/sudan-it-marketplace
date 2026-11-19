import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/widgets/app_surfaces.dart';

/// The pictures of a product as on sictm.net (`.product-media` + `.thumbs`):
/// one picture 16:10 with 18 px corners; several can be swiped, with 64 px
/// thumbnails below (the shown one framed in navy) that pick a picture.
/// [placeholder] fills the frame when there is no picture (the category's
/// colour and shape), and [overlay] sits on top (the offer badge).
class ProductGallery extends StatefulWidget {
  const ProductGallery({
    super.key,
    required this.urls,
    this.overlay,
    this.placeholder,
    this.aspectRatio = 16 / 10,
  });

  final List<String> urls;
  final Widget? overlay;
  final Widget? placeholder;
  final double aspectRatio;

  @override
  State<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends State<ProductGallery> {
  final _pages = PageController();
  int _page = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _show(int i) {
    setState(() => _page = i);
    _pages.animateToPage(
      i,
      duration: AppMotion.overlay,
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.urls;
    final colors = context.colors;
    Widget image(String url) => AppNetworkImage(
      url: url,
      fit: BoxFit.contain,
      fallback: widget.placeholder ?? const SizedBox.shrink(),
    );
    final Widget picture;
    if (urls.isEmpty) {
      picture = widget.placeholder ?? const SizedBox.shrink();
    } else if (urls.length == 1) {
      picture = image(urls.first);
    } else {
      picture = PageView.builder(
        key: const ValueKey('product-gallery'),
        controller: _pages,
        itemCount: urls.length,
        onPageChanged: (i) => setState(() => _page = i),
        itemBuilder: (_, i) => image(urls[i]),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AspectRatio(
          aspectRatio: widget.aspectRatio,
          child: Container(
            decoration: BoxDecoration(
              color: colors.bgSubtle,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.borderDefault),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [picture, ?widget.overlay],
            ),
          ),
        ),
        if (urls.length > 1) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (var i = 0; i < urls.length; i++)
                Semantics(
                  button: true,
                  selected: i == _page,
                  label: context.l10n.siteProductPicture(i + 1),
                  child: GestureDetector(
                    onTap: () => _show(i),
                    child: AnimatedContainer(
                      duration: AppMotion.state,
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: colors.bgSubtle,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: i == _page
                              ? colors.primary
                              : colors.borderDefault,
                          width: 2,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: AppNetworkImage(
                        url: urls[i],
                        fit: BoxFit.cover,
                        fallback: const SizedBox.shrink(),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

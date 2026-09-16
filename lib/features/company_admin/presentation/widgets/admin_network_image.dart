import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Square thumbnail that falls back to an icon when there is no image URL or
/// the image fails to load.
class AdminNetworkImage extends StatelessWidget {
  const AdminNetworkImage({
    super.key,
    required this.url,
    required this.fallbackIcon,
    this.size = 52,
    this.radius = 10,
  });

  final String? url;
  final IconData fallbackIcon;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final fallback = Center(
      child: Icon(fallbackIcon, color: AppColors.primary, size: size * 0.5),
    );
    final imageUrl = url?.trim() ?? '';
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.secondary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AppColors.secondary.withValues(alpha: 0.15)),
      ),
      child: imageUrl.isEmpty
          ? fallback
          : Image.network(
              imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => fallback,
            ),
    );
  }
}

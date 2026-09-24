import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';

/// Bordered surface: the base of every card in the product. 12 px radius and a
/// 1 px border, no shadow (Figma: cards rely on border, not elevation).
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.s12),
    this.onTap,
    this.color = AppColors.surface,
    this.borderColor = AppColors.borderDefault,
    this.borderWidth = AppBorder.thin,
    this.semanticLabel,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color color;
  final Color borderColor;
  final double borderWidth;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final card = Material(
      color: color,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Container(
          width: double.infinity,
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: borderColor, width: borderWidth),
          ),
          child: child,
        ),
      ),
    );
    return semanticLabel == null
        ? card
        : Semantics(label: semanticLabel, container: true, child: card);
  }
}

/// A card with a title (and an optional chip or action at the end) followed by
/// its content (Figma pattern "Section card").
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    this.title,
    required this.children,
    this.trailing,
    this.gap = AppSpacing.s12,
  });

  final String? title;
  final Widget? trailing;
  final List<Widget> children;

  /// Space between the title row and the content.
  final double gap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Row(
              children: [
                Expanded(child: Text(title!, style: AppTextStyles.h3)),
                ?trailing,
              ],
            ),
            SizedBox(height: gap),
          ],
          ...children,
        ],
      ),
    );
  }
}

/// Label at the start, value at the end (Figma component "Key-value row").
/// Long values wrap instead of pushing the layout wider than the screen.
/// [emphasize] (brand colour, bold) is reserved for totals and prices.
class KeyValueRow extends StatelessWidget {
  const KeyValueRow({
    super.key,
    required this.label,
    required this.value,
    this.emphasize = false,
    this.valueColor,
    this.valueTextDirection,
  });

  final String label;
  final String value;
  final bool emphasize;
  final Color? valueColor;

  /// Keeps a phone number or order code left-to-right inside an RTL screen.
  final TextDirection? valueTextDirection;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(width: AppSpacing.s12),
          Expanded(
            flex: 3,
            // Aligned to the end of the row by position, not by the text's
            // own direction, so a left-to-right value (phone, code, date)
            // lines up with the other values in Arabic too.
            child: Align(
              alignment: AlignmentDirectional.centerEnd,
              child: Text(
                value,
                textAlign: TextAlign.end,
                textDirection: valueTextDirection,
                style: AppTextStyles.bodyStrong.copyWith(
                  color: valueColor ??
                      (emphasize ? AppColors.textBrand : AppColors.textPrimary),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Heading of a list block with an optional link at the end ("View all").
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(title, style: AppTextStyles.h3)),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              minimumSize: const Size(48, AppSize.controlSm),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
            ),
            child: Text(actionLabel!),
          ),
      ],
    );
  }
}

/// Tinted rounded square holding an icon (Figma "icon tile").
class AppIconTile extends StatelessWidget {
  const AppIconTile({
    super.key,
    required this.icon,
    this.tone = AppTone.brand,
    this.size = 44,
    this.radius = AppRadius.sm,
    this.iconSize,
  });

  final IconData icon;
  final AppTone tone;
  final double size;
  final double radius;

  /// Defaults to half of [size].
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Icon(icon, size: iconSize ?? size * 0.5, color: tone.accent),
    );
  }
}

/// Circle showing a photo, or the first letter of the name when there is none.
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    required this.name,
    this.imageUrl,
    this.size = AppSize.avatarMd,
  });

  final String name;
  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final initial = trimmed.isEmpty ? '?' : trimmed.characters.first;
    final fallback = Center(
      child: Text(
        initial,
        style: AppTextStyles.h3.copyWith(
          color: AppColors.textBrand,
          fontSize: size * 0.4,
          height: 1,
        ),
      ),
    );
    final url = imageUrl ?? '';
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        color: AppColors.brandPrimarySubtle,
        shape: BoxShape.circle,
      ),
      child: AppNetworkImage(url: url, fallback: fallback),
    );
  }
}

/// Square thumbnail: the picture when there is one, otherwise a tinted tile
/// with [fallbackIcon] (or the first letter of [fallbackText]).
class AppImageTile extends StatelessWidget {
  const AppImageTile({
    super.key,
    this.imageUrl,
    this.fallbackIcon = Icons.inventory_2_outlined,
    this.fallbackText,
    this.size = AppSize.avatarLg,
    this.tone = AppTone.brand,
    this.radius = AppRadius.sm,
    this.expand = false,
  });

  final String? imageUrl;
  final IconData fallbackIcon;

  /// Shown instead of the icon when set (company logos fall back to a letter).
  final String? fallbackText;
  final double size;
  final AppTone tone;
  final double radius;

  /// Fill the available width, keeping [size] as the height (detail hero).
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final text = fallbackText?.trim() ?? '';
    final Widget fallback = Center(
      child: text.isEmpty
          ? Icon(fallbackIcon, size: size * 0.46, color: tone.accent)
          : Text(
              text.characters.first.toUpperCase(),
              style: AppTextStyles.h3.copyWith(color: tone.foreground),
            ),
    );
    final url = imageUrl ?? '';
    return Container(
      width: expand ? double.infinity : size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: AppNetworkImage(url: url, fallback: fallback),
    );
  }
}

/// A tappable row card: [leading] (thumbnail or icon tile), the [content]
/// column, and a chevron at the end (which mirrors in RTL). Used for products,
/// services, companies and orders in lists.
class AppListCard extends StatelessWidget {
  const AppListCard({
    super.key,
    required this.content,
    this.leading,
    this.onTap,
    this.trailing,
    this.showChevron = true,
  });

  final Widget content;
  final Widget? leading;
  final VoidCallback? onTap;

  /// Replaces the chevron (for example a status chip).
  final Widget? trailing;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          if (leading != null) ...[
            leading!,
            const SizedBox(width: AppSpacing.s12),
          ],
          Expanded(child: content),
          if (trailing != null) ...[
            const SizedBox(width: AppSpacing.s8),
            trailing!,
          ] else if (showChevron) ...[
            const SizedBox(width: AppSpacing.s4),
            const Icon(
              Icons.chevron_right_rounded,
              color: AppColors.iconMuted,
            ),
          ],
        ],
      ),
    );
  }
}

/// Scrolling page body: the screen margin at the sides, content centred and
/// capped at [maxWidth] so forms and details stay readable on tablets and web.
class AppCenteredList extends StatelessWidget {
  const AppCenteredList({
    super.key,
    required this.children,
    this.maxWidth = AppSize.readingMax,
    this.topPadding = AppSpacing.s16,
    this.bottomPadding = AppSpacing.s24,
    this.controller,
  });

  final List<Widget> children;
  final double maxWidth;
  final double topPadding;
  final double bottomPadding;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    return ListView(
      controller: controller,
      padding: EdgeInsets.fromLTRB(margin, topPadding, margin, bottomPadding),
      // Each child is its own list item, so long pages still build lazily
      // and scroll item by item.
      children: [
        for (final child in children)
          Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: SizedBox(width: double.infinity, child: child),
            ),
          ),
      ],
    );
  }
}

/// A picture from a URL that shows [fallback] while there is no URL and when
/// the picture cannot be loaded. The one place that decides how remote images
/// fail.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.url,
    required this.fallback,
    this.fit = BoxFit.cover,
  });

  final String url;
  final Widget fallback;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) return fallback;
    return Image.network(
      url,
      fit: fit,
      errorBuilder: (_, _, _) => fallback,
    );
  }
}

/// Small brand-coloured dot marking something unread. Decoration only: pair it
/// with bold text or a semantic label for readers that do not see colour.
class AppUnreadDot extends StatelessWidget {
  const AppUnreadDot({super.key, this.size = 10});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
      ),
    );
  }
}

/// Bar pinned to the bottom of a screen (buy bar, message composer): surface
/// colour, a top border, the system inset kept clear.
class AppBottomBar extends StatelessWidget {
  const AppBottomBar({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.symmetric(
      horizontal: AppSpacing.s16,
      vertical: AppSpacing.s12,
    ),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.borderDefault)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// The application logo on the sign-in and registration screens.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 96});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Image.asset(
        'assets/images/app_logo.png',
        width: size,
        height: size,
      ),
    );
  }
}

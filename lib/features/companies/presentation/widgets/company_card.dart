import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/company.dart';
import '../company_details_screen.dart';
import '../../../../core/localization/l10n_extension.dart';

class CompanyCard extends StatelessWidget {
  const CompanyCard({
    super.key,
    required this.company,
  });

  final Company company;

  Widget _buildLogo(TextTheme textTheme) {
    final fallback = Center(
      child: Text(
        company.name.isNotEmpty
            ? company.name.substring(0, 1).toUpperCase()
            : 'C',
        style: textTheme.titleMedium?.copyWith(
          color: AppColors.primary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
    final logoUrl = company.logoUrl;
    if (logoUrl == null || logoUrl.isEmpty) {
      return fallback;
    }
    return Image.network(
      logoUrl,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => fallback,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isCompact = screenWidth < 360;
    final avatarSize = isCompact ? 44.0 : 52.0;
    final cardPadding = isCompact ? 12.0 : 14.0;

    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => CompanyDetailsScreen(company: company),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: EdgeInsets.all(cardPadding),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: colorScheme.onSurface.withValues(alpha: 0.08),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: avatarSize,
                height: avatarSize,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.15),
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: _buildLogo(textTheme),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      company.name,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          color: Colors.amber,
                          size: 18,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          company.rating.toStringAsFixed(1),
                          style: textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            context.l10n.reviewsCount(company.reviewCount),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurface.withValues(alpha: 0.6),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              Icon(
                Icons.chevron_right_rounded,
                color: colorScheme.onSurface.withValues(alpha: 0.35),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

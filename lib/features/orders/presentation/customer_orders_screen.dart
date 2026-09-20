import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import 'orders_providers.dart';
import 'widgets/order_card.dart';
import '../../../core/localization/l10n_extension.dart';

class CustomerOrdersScreen extends ConsumerWidget {
  const CustomerOrdersScreen({
    super.key,
    this.showAppBar = false,
  });

  final bool showAppBar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    final ordersAsync = ref.watch(customerOrdersStreamProvider);

    final body = ordersAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(),
      ),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: AppColors.error,
              ),
              const SizedBox(height: 14),
              Text(
                context.l10n.ordersLoadFailed,
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                error.toString(),
                textAlign: TextAlign.center,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: () => ref.invalidate(customerOrdersStreamProvider),
                child: Text(context.l10n.ordersRetry),
              ),
            ],
          ),
        ),
      ),
      data: (orders) {
        if (orders.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.shopping_bag_outlined,
                      size: 40,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    context.l10n.ordersEmptyTitle,
                    style: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    context.l10n.ordersEmptyBody,
                    textAlign: TextAlign.center,
                    style: textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.65),
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          itemCount: orders.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            return OrderCard(order: orders[index]);
          },
        );
      },
    );

    if (showAppBar) {
      return Scaffold(
        appBar: AppBar(
          title: Text(context.l10n.navMyOrders),
        ),
        body: body,
      );
    }

    return body;
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/widgets/app_widgets.dart';
import 'orders_providers.dart';
import 'widgets/order_card.dart';

class CustomerOrdersScreen extends ConsumerWidget {
  const CustomerOrdersScreen({
    super.key,
    this.showAppBar = false,
  });

  final bool showAppBar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final ordersAsync = ref.watch(customerOrdersStreamProvider);
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    final body = ordersAsync.when(
      loading: () => ListView(
        padding: EdgeInsets.all(margin),
        children: const [AppSkeletonList()],
      ),
      // The raw exception is for the log, not for the customer.
      error: (error, _) => AppErrorState(
        title: l10n.ordersLoadFailed,
        message: l10n.errorGeneric,
        onRetry: () => ref.invalidate(customerOrdersStreamProvider),
      ),
      data: (orders) {
        if (orders.isEmpty) {
          return AppEmptyState(
            icon: Icons.shopping_bag_outlined,
            title: l10n.ordersEmptyTitle,
            message: l10n.ordersEmptyBody,
            expandVertically: true,
          );
        }

        return ListView.separated(
          padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
          itemCount: orders.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s12),
          itemBuilder: (context, index) {
            return OrderCard(order: orders[index]);
          },
        );
      },
    );

    if (showAppBar) {
      return Scaffold(
        appBar: AppBar(
          title: Text(l10n.navMyOrders),
        ),
        body: body,
      );
    }

    return body;
  }
}

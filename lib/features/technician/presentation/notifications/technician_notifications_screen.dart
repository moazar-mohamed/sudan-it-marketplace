import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../technician_format.dart';
import '../jobs/technician_job_details_screen.dart';
import '../widgets/technician_widgets.dart';

/// The app has no notification backend yet, so this screen lists job
/// activity for the technician's own assigned installation jobs.
class TechnicianNotificationsScreen extends ConsumerWidget {
  const TechnicianNotificationsScreen({super.key, required this.technicianId});

  final String technicianId;

  ({IconData icon, Color color, String title, String body}) _describe(
    OrderEntity job,
    ColorScheme colorScheme,
  ) {
    return switch (job.orderStatus) {
      OrderStatus.processing => (
          icon: Icons.assignment_outlined,
          color: colorScheme.primary,
          title: 'Installation job assigned to you',
          body: job.productName,
        ),
      OrderStatus.outForDelivery => (
          icon: Icons.local_shipping_outlined,
          color: Colors.deepOrange,
          title: 'Order out for delivery — installation pending',
          body: job.productName,
        ),
      OrderStatus.completed => (
          icon: Icons.check_circle_outline,
          color: Colors.green,
          title: 'Installation completed',
          body: job.productName,
        ),
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(technicianOrdersStreamProvider(technicianId));
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: jobsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => TechnicianErrorState(
          message: 'Could not load notifications.',
          onRetry: () =>
              ref.invalidate(technicianOrdersStreamProvider(technicianId)),
        ),
        data: (jobs) {
          final items = [...jobs]..sort((a, b) =>
              (b.updatedAt ?? b.createdAt).compareTo(a.updatedAt ?? a.createdAt));
          if (items.isEmpty) {
            return ListView(
              children: const [
                TechnicianEmptyState(
                  icon: Icons.notifications_none_outlined,
                  message: 'No notifications yet.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final job = items[index];
              final info = _describe(job, colorScheme);
              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: info.color.withValues(alpha: 0.12),
                  foregroundColor: info.color,
                  child: Icon(info.icon),
                ),
                title: Text(
                  info.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  '${info.body}\nJob #${job.shortId} • '
                  '${TechnicianFormat.date(job.updatedAt ?? job.createdAt)}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                isThreeLine: true,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => TechnicianJobDetailsScreen(
                      technicianId: technicianId,
                      orderId: job.id,
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

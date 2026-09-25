import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/error_messages.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../orders_providers.dart';

/// "View receipt" button for an order's payment card. Shown to the customer and
/// to the owning company's admin only (never on a technician's screen). The
/// image is NOT loaded with the order: it is fetched when the button is tapped,
/// which keeps order screens light and saves database reads.
class ReceiptViewButton extends StatelessWidget {
  const ReceiptViewButton({super.key, required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.s12),
      child: AppButton.outlined(
        label: context.l10n.receiptView,
        icon: Icons.receipt_long_outlined,
        size: AppButtonSize.medium,
        expand: true,
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ReceiptViewerScreen(orderId: orderId),
          ),
        ),
      ),
    );
  }
}

/// Full-screen receipt: loads `order_receipts/{orderId}` (the rules only allow
/// the order's customer, the owning company's admin and Platform Admin), shows
/// a clean "no image" message for orders placed before receipts were stored,
/// and lets the reader pinch-zoom.
class ReceiptViewerScreen extends ConsumerWidget {
  const ReceiptViewerScreen({super.key, required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final receipt = ref.watch(orderReceiptProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.receiptViewTitle)),
      body: receipt.when(
        loading: () => const AppLoadingState(),
        error: (error, _) => AppErrorState(
          message: localizedErrorMessage(l10n, error),
          onRetry: () => ref.invalidate(orderReceiptProvider(orderId)),
        ),
        data: (data) {
          if (data == null) {
            return AppEmptyState(
              icon: Icons.image_not_supported_outlined,
              message: l10n.receiptNone,
              expandVertically: true,
            );
          }
          return Column(
            children: [
              Expanded(
                child: ColoredBox(
                  color: AppColors.bgInverse,
                  child: InteractiveViewer(
                    minScale: 1,
                    maxScale: 5,
                    child: Center(
                      child: Image.memory(
                        data.image.bytes,
                        key: const ValueKey('receipt-image'),
                        fit: BoxFit.contain,
                        gaplessPlayback: true,
                      ),
                    ),
                  ),
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.s12),
                  child: Text(
                    '${data.image.fileName} · ${(data.image.sizeBytes / 1024).round()} KB',
                    textDirection: TextDirection.ltr,
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/phone_number.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../chats/presentation/chat_screen.dart';
import '../../cities/domain/sudan_city.dart';
import '../../location/presentation/location_strings.dart';
import '../../reviews/presentation/review_widgets.dart';
import '../../reviews/presentation/reviews_providers.dart';
import '../../tech_chat/domain/tech_chat.dart';
import '../../tech_chat/presentation/tech_chat_screen.dart';
import '../domain/entities/order_entity.dart';
import 'order_chat_actions.dart';
import 'orders_providers.dart';
import 'widgets/order_cancelled_note.dart';
import 'widgets/order_location_widgets.dart';
import 'order_labels.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../customer_dashboard/presentation/site/site_orders.dart';
import '../../../core/localization/l10n_extension.dart';
import 'widgets/receipt_viewer.dart';

class OrderDetailsScreen extends ConsumerWidget {
  const OrderDetailsScreen({
    super.key,
    required this.order,
  });

  final OrderEntity order;

  String _resolveCompanyName() {
    if (order.companyName.isNotEmpty) {
      return order.companyName;
    }
    return 'IT Partner Co.';
  }

  String _formatDate(DateTime dt) {
    final y = dt.year;
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $h:$min';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final companyName = _resolveCompanyName();
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    const gap = SizedBox(height: AppSpacing.s16);

    return Scaffold(
      appBar: AppBar(),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SitePageTitle(l10n.orderTitleNumber(order.shortId)),
                gap,
                // Processing -> Out for delivery -> Completed.
                _buildStatusFlowCard(context),
                gap,

                // Once delivered, the customer rates it (or sees their rating).
                if (order.orderStatus == OrderStatus.completed) ...[
                  SubjectReviewCard(
                    subject: ReviewSubject.order(order),
                    asCompany: false,
                  ),
                  gap,
                ],

                SiteSection(
                  title: l10n.adminContact,
                  children: [
                    _OrderChatButton(order: order),
                    _TechnicianContact(order: order),
                  ],
                ),
                gap,

                SiteSection(
                  title: l10n.orderItemOrdered,
                  gap: AppSpacing.s12,
                  children: [
                    // The product's name, its company, then the unit price
                    // and quantity (as the site lists them).
                    Text(
                      order.productName,
                      style: AppTextStyles.bodyStrong.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      companyName,
                      style: AppTextStyles.caption.copyWith(
                        fontSize: 13,
                        color: context.colors.textSecondary,
                      ),
                    ),
                    SiteSpecs(
                      entries: [
                        MapEntry(
                          l10n.adminUnitPrice,
                          sitePrice(context, order.unitPrice),
                        ),
                        MapEntry(l10n.adminQuantity, '${order.quantity}'),
                      ],
                    ),
                  ],
                ),
                gap,

                SiteSection(
                  title: order.deliveryMethod == DeliveryMethod.pickup
                      ? l10n.orderPickupDetails
                      : l10n.orderDeliveryDetails,
                  gap: AppSpacing.s8,
                  children: [
                    KeyValueRow(
                      label: l10n.orderAddress,
                      value: orderDeliveryLabel(context, order),
                    ),
                    if (order.deliveryMethod == DeliveryMethod.delivery &&
                        cityById(order.deliveryCityId) != null)
                      KeyValueRow(
                        label: l10n.orderDeliveryCity,
                        value: cityById(order.deliveryCityId)!.name(
                          Localizations.localeOf(context).languageCode,
                        ),
                      ),
                    OrderLocationButton(
                      order: order,
                      label: LocationStrings.of(context).openDeliveryLocation,
                    ),
                    PickupCompanyLocationButton(order: order),
                    KeyValueRow(
                      label: l10n.orderContactPhone,
                      value: displayPhone(order.contactPhone),
                      valueTextDirection: TextDirection.ltr,
                    ),
                    if (order.installationSelected)
                      KeyValueRow(
                        label: l10n.orderType,
                        value: l10n.orderTypeInstallation(
                          sitePrice(context, order.installationFee),
                        ),
                        valueColor: context.colors.textBrand,
                      ),
                    if (order.deliveryMethod == DeliveryMethod.delivery)
                      KeyValueRow(
                        label: l10n.orderDeliveryFee,
                        value: sitePrice(context, order.deliveryFee),
                      ),
                    KeyValueRow(
                      label: l10n.orderOrderedAt,
                      value: _formatDate(order.createdAt),
                      valueTextDirection: TextDirection.ltr,
                    ),
                  ],
                ),
                gap,

                SiteSection(
                  title: l10n.orderPaymentStatus,
                  gap: AppSpacing.s8,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          l10n.orderStatusLabel,
                          style: AppTextStyles.body
                              .copyWith(color: context.colors.textSecondary),
                        ),
                        StatusChip(
                          label: order.paymentLabel(l10n),
                          tone: order.paymentTone,
                        ),
                      ],
                    ),
                    if (order.receiptFileName != null)
                      KeyValueRow(
                        label: l10n.orderReceiptAttached,
                        value: order.receiptFileName!,
                        valueColor: context.colors.successText,
                      ),
                    if (order.receiptFileName != null)
                      ReceiptViewButton(orderId: order.id),
                    // A receipt is not a confirmed payment: only the
                    // company's confirmation reserves the product.
                    if (order.isAwaitingPaymentVerification)
                      AppBanner(
                        key: const ValueKey('order-not-reserved-yet'),
                        icon: Icons.inventory_2_outlined,
                        message: l10n.orderNotReservedYet,
                      )
                    else if (order.paymentStatus == PaymentStatus.confirmed &&
                        !order.isCancelled)
                      AppBanner(
                        key: const ValueKey('order-payment-confirmed-note'),
                        tone: AppTone.success,
                        message: l10n.orderPaymentConfirmedNote,
                      ),
                  ],
                ),
                gap,

                SiteTile(
                  child: SiteSummary(
                    rows: [
                      (
                        l10n.orderProductSubtotal,
                        sitePrice(context, order.productSubtotal),
                      ),
                      if (order.installationSelected)
                        (
                          l10n.orderInstallationFee,
                          '+${sitePrice(context, order.installationFee)}',
                        ),
                      if (order.deliveryMethod == DeliveryMethod.delivery)
                        (
                          l10n.orderDeliveryFee,
                          sitePrice(context, order.deliveryFee),
                        ),
                    ],
                    total: (l10n.orderTotal, sitePrice(context, order.totalAmount)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusFlowCard(BuildContext context) {
    final l10n = context.l10n;
    const steps = [
      OrderStatus.processing,
      OrderStatus.outForDelivery,
      OrderStatus.completed,
    ];
    final currentIndex = steps.indexOf(order.orderStatus);

    return SiteSection(
      title: l10n.orderOrderStatus,
      trailing: SiteTonePill(
        label: order.orderStatus.label(l10n),
        tone: siteOrderTone(order.orderStatus),
      ),
      gap: AppSpacing.s16,
      children: [
        // A cancelled order has no progress to show, only what happened.
        if (order.isCancelled)
          OrderCancelledNote(order: order)
        else
          AppStepTracker(
            labels: [for (final step in steps) step.label(l10n)],
            currentIndex: currentIndex,
            allDone: order.orderStatus == OrderStatus.completed,
          ),
      ],
    );
  }
}

/// Once the company sends a technician: their name and a conversation with
/// them (their phone number is not shown). Follows the order live, so it
/// appears as soon as the technician is assigned.
class _TechnicianContact extends ConsumerWidget {
  const _TechnicianContact({required this.order});

  final OrderEntity order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final live = ref.watch(orderStreamProvider(order.id)).asData?.value ?? order;
    if ((live.technicianId ?? '').isEmpty) return const SizedBox.shrink();
    final name = (live.technicianName ?? '').trim();
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (name.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s8),
              child: Row(
                children: [
                  Icon(
                    Icons.engineering_outlined,
                    size: AppSize.iconSm,
                    color: context.colors.iconDefault,
                  ),
                  const SizedBox(width: AppSpacing.s6),
                  Expanded(
                    child: Text(
                      context.l10n.tcTechnicianName(name),
                      style: AppTextStyles.bodyStrong,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          TechChatButton(
            orderId: live.id,
            viewer: TechChatViewer.customer,
            label: context.l10n.tcChatWithTechnician,
          ),
        ],
      ),
    );
  }
}

/// Opens the conversation with the order's company: most orders already have
/// one (opened together with the order); an older order gets one on demand.
class _OrderChatButton extends ConsumerStatefulWidget {
  const _OrderChatButton({required this.order});

  final OrderEntity order;

  @override
  ConsumerState<_OrderChatButton> createState() => _OrderChatButtonState();
}

class _OrderChatButtonState extends ConsumerState<_OrderChatButton> {
  bool _starting = false;

  Future<void> _openChat() {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChatScreen(
          chatId: widget.order.id,
          role: ChatParticipantRole.customer,
        ),
      ),
    );
  }

  Future<void> _start() async {
    setState(() => _starting = true);
    final error =
        await ref.read(orderChatActionsProvider).start(widget.order);
    if (!mounted) return;
    setState(() => _starting = false);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    await _openChat();
  }

  @override
  Widget build(BuildContext context) {
    final conversationAsync =
        ref.watch(chatConversationProvider(widget.order.id));
    return conversationAsync.when(
      loading: () => const SizedBox(
        height: AppSize.controlLg,
        child: Center(child: AppSpinner()),
      ),
      error: (_, _) => AppButton.outlined(
        expand: true,
        icon: Icons.chat_bubble_outline,
        label: context.l10n.orderStartChat,
        loading: _starting,
        onPressed: _start,
      ),
      data: (conversation) => AppButton.outlined(
        expand: true,
        icon: Icons.chat_bubble_outline,
        loading: _starting,
        label: conversation == null
            ? context.l10n.orderStartChat
            : context.l10n.serviceRequestOpenChat,
        onPressed: conversation == null ? _start : _openChat,
      ),
    );
  }
}

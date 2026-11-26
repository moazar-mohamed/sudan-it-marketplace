import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/push/push_relay.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/domain/entities/chat_message.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../chats/presentation/widgets/message_bubble.dart';
import '../../orders/domain/entities/order_entity.dart';
import '../../orders/presentation/orders_providers.dart';
import '../domain/tech_chat.dart';
import 'tech_chat_providers.dart';
import '../../../core/widgets/jump_to_latest.dart';

/// True while the customer and the technician may still write (the rules
/// close the conversation once the order is completed or cancelled).
bool techChatIsOpen(OrderEntity order) =>
    (order.technicianId ?? '').isNotEmpty &&
    order.orderStatus != OrderStatus.completed &&
    order.orderStatus != OrderStatus.cancelled;

/// The conversation between an order's customer and its technician. The
/// company opens it too, to read only.
class TechChatScreen extends ConsumerStatefulWidget {
  const TechChatScreen({
    super.key,
    required this.orderId,
    required this.viewer,
  });

  final String orderId;
  final TechChatViewer viewer;

  @override
  ConsumerState<TechChatScreen> createState() => _TechChatScreenState();
}

class _TechChatScreenState extends ConsumerState<TechChatScreen> {
  final _controller = TextEditingController();
  bool _sending = false;
  bool _markingRead = false;

  @override
  void initState() {
    super.initState();
    ref.listenManual(
      techChatProvider(widget.orderId),
      (_, next) => _markReadIfNeeded(next.asData?.value),
      fireImmediately: true,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _markReadIfNeeded(TechChat? chat) async {
    final role = widget.viewer.role;
    if (role == null || chat == null || _markingRead || !chat.isUnreadFor(role)) {
      return;
    }
    _markingRead = true;
    await ref
        .read(techChatStoreProvider)
        .markRead(orderId: widget.orderId, role: role);
    if (mounted) _markingRead = false;
  }

  Future<void> _send(OrderEntity order) async {
    final role = widget.viewer.role;
    final text = _controller.text.trim();
    final uid = ref.read(currentUserIdProvider);
    if (role == null || text.isEmpty || _sending || uid == null) return;
    setState(() => _sending = true);
    String? error;
    try {
      final messageId = await ref.read(techChatStoreProvider).send(
            orderId: widget.orderId,
            companyId: order.companyId,
            customerId: order.customerId,
            productName: order.productName,
            senderId: uid,
            senderRole: role,
            senderName: role == TechChatRole.technician
                ? (order.technicianName ?? '')
                : order.customerName,
            text: text,
            existing:
                ref.read(techChatProvider(widget.orderId)).asData?.value != null,
          );
      // The other side's phone hears about it (in the background).
      unawaited(
        ref.read(pushRelayProvider).techChatMessage(
              orderId: widget.orderId,
              messageId: messageId,
            ),
      );
    } catch (e) {
      error = localizedErrorMessage(ref.read(appLocalizationsProvider), e);
    }
    if (!mounted) return;
    setState(() => _sending = false);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final order = ref.watch(orderStreamProvider(widget.orderId)).asData?.value;
    final technicianName = (order?.technicianName ?? '').trim().isEmpty
        ? l10n.tcTechnician
        : order!.technicianName!.trim();
    final customerName = (order?.customerName ?? '').trim().isEmpty
        ? l10n.chatCustomerFallback
        : order!.customerName.trim();
    final title = switch (widget.viewer) {
      TechChatViewer.customer => technicianName,
      TechChatViewer.technician => customerName,
      TechChatViewer.company => l10n.tcChatCustomerTechnician,
    };
    final isOpen = order != null && techChatIsOpen(order);
    final writes = widget.viewer.role != null;
    final notice = !writes
        ? l10n.tcChatReadOnly
        : (order != null && !isOpen ? l10n.tcChatClosed : l10n.tcChatNotice);
    final messagesAsync = ref.watch(techChatMessagesProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (order != null)
              Text(
                order.productName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  color: Theme.of(context).appBarTheme.foregroundColor,
                ),
              ),
          ],
        ),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s16,
              vertical: AppSpacing.s8,
            ),
            color: AppTone.info.background(context.colors),
            child: Row(
              children: [
                Icon(
                  writes ? Icons.visibility_outlined : Icons.lock_outline,
                  size: 16,
                  color: AppTone.info.accent(context.colors),
                ),
                const SizedBox(width: AppSpacing.s8),
                Expanded(
                  child: Text(
                    notice,
                    style: AppTextStyles.captionStrong.copyWith(
                      color: AppTone.info.foreground(context.colors),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: messagesAsync.when(
              loading: () => const AppLoadingState(),
              error: (_, _) => AppErrorState(
                message: l10n.chatLoadFailed,
                onRetry: () =>
                    ref.invalidate(techChatMessagesProvider(widget.orderId)),
              ),
              data: (messages) {
                if (messages.isEmpty) {
                  return AppEmptyState(
                    icon: Icons.chat_bubble_outline,
                    message: writes ? l10n.tjChatEmpty : l10n.tcChatEmptyCompany,
                    expandVertically: true,
                  );
                }
                final newestFirst = messages.reversed.toList();
                return JumpToLatest(items: [for (final m in messages) (id: m.id, mine: writes && m.senderRole == widget.viewer.role)], child: ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.all(AppSpacing.s12),
                  itemCount: newestFirst.length,
                  itemBuilder: (context, index) {
                    final message = newestFirst[index];
                    final older = index + 1 < newestFirst.length
                        ? newestFirst[index + 1]
                        : null;
                    final fromTechnician =
                        message.senderRole == TechChatRole.technician;
                    final name = message.senderName.trim().isNotEmpty
                        ? message.senderName.trim()
                        : (fromTechnician ? l10n.tcTechnician : customerName);
                    // The company reads it with its technician on the end side.
                    final isMine = writes
                        ? message.senderRole == widget.viewer.role
                        : fromTechnician;
                    return MessageBubble(
                      message: ChatMessage(
                        id: message.id,
                        senderId: message.senderId,
                        // Only used by the bubble to place and name the side.
                        senderRole: fromTechnician
                            ? ChatParticipantRole.company
                            : ChatParticipantRole.customer,
                        senderName: name,
                        text: message.text,
                        createdAt: message.createdAt,
                        isPending: message.isPending,
                      ),
                      isMine: isMine,
                      mineLabel: writes ? null : name,
                      showSender: older == null ||
                          older.senderRole != message.senderRole,
                    );
                  },
                ));
              },
            ),
          ),
          if (writes && order != null && isOpen)
            AppBottomBar(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.s12,
                AppSpacing.s8,
                AppSpacing.s8,
                AppSpacing.s8,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      key: const ValueKey('tech-chat-input'),
                      controller: _controller,
                      minLines: 1,
                      maxLines: 5,
                      maxLength: TechChatMessage.maxLength,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: l10n.tjChatHint,
                        counterText: '',
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.s6),
                  IconButton.filled(
                    key: const ValueKey('tech-chat-send'),
                    style: IconButton.styleFrom(
                      foregroundColor: context.colors.onPrimary,
                    ),
                    tooltip: l10n.chatSend,
                    onPressed: _sending ? null : () => _send(order),
                    icon: _sending
                        ? const AppSpinner()
                        : const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Opens an order's customer-technician conversation, as a full-width
/// button; a small dot shows when the other side wrote last. Shown only
/// once the order has a technician.
class TechChatButton extends ConsumerWidget {
  const TechChatButton({
    super.key,
    required this.orderId,
    required this.viewer,
    required this.label,
  });

  final String orderId;
  final TechChatViewer viewer;
  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = viewer.role;
    final chat = ref.watch(techChatProvider(orderId)).asData?.value;
    final unread = role != null && (chat?.isUnreadFor(role) ?? false);
    return Stack(
      children: [
        AppButton.outlined(
          key: const ValueKey('tech-chat-open'),
          expand: true,
          icon: Icons.forum_outlined,
          label: label,
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => TechChatScreen(orderId: orderId, viewer: viewer),
            ),
          ),
        ),
        if (unread)
          const PositionedDirectional(top: 8, end: 8, child: AppUnreadDot()),
      ],
    );
  }
}

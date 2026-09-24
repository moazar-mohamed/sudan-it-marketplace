import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../service_requests/presentation/service_request_details_screen.dart';
import '../../service_requests/presentation/service_request_labels.dart';
import '../../service_requests/presentation/service_request_providers.dart';
import '../domain/entities/chat_conversation.dart';
import '../domain/entities/chat_message.dart';
import 'chat_actions.dart';
import 'chat_providers.dart';
import 'widgets/message_bubble.dart';

/// The realtime text conversation of one service request, seen by the
/// customer or by the company ([role]).
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.chatId, required this.role});

  final String chatId;
  final ChatParticipantRole role;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _controller = TextEditingController();
  bool _sending = false;
  bool _markingRead = false;

  @override
  void initState() {
    super.initState();
    ref.listenManual(
      chatConversationProvider(widget.chatId),
      (_, next) => _markReadIfNeeded(next.asData?.value),
      fireImmediately: true,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Keeps this side's read marker current while the conversation is open,
  /// so new messages from the other side never stay "unread" here.
  Future<void> _markReadIfNeeded(ChatConversation? conversation) async {
    if (conversation == null ||
        _markingRead ||
        !conversation.isUnreadFor(widget.role)) {
      return;
    }
    _markingRead = true;
    await ref
        .read(chatActionsProvider)
        .markRead(chatId: conversation.id, role: widget.role);
    if (mounted) _markingRead = false;
  }

  Future<void> _send(ChatConversation conversation) async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    final error = await ref.read(chatActionsProvider).send(
          conversation: conversation,
          role: widget.role,
          text: text,
        );
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
    final conversationAsync = ref.watch(chatConversationProvider(widget.chatId));
    final conversation = conversationAsync.asData?.value;

    final isCustomer = widget.role == ChatParticipantRole.customer;
    final counterpart = conversation == null
        ? ''
        : isCustomer
            ? conversation.companyName
            : (conversation.customerName.trim().isEmpty
                ? context.l10n.chatCustomerFallback
                : conversation.customerName);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              counterpart.isEmpty ? context.l10n.navChats : counterpart,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (conversation != null)
              Text(
                conversation.serviceName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                // Readable on the app bar's own colour.
                style: AppTextStyles.caption.copyWith(color: AppColors.onPrimary),
              ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: context.l10n.serviceRequestViewDetails,
            icon: const Icon(Icons.info_outline),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => ServiceRequestDetailsScreen(
                  requestId: widget.chatId,
                  asCompany: !isCustomer,
                  showChatAction: false,
                ),
              ),
            ),
          ),
        ],
      ),
      body: conversationAsync.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => AppErrorState(
          message: context.l10n.chatLoadFailed,
          onRetry: () => ref.invalidate(chatConversationProvider(widget.chatId)),
        ),
        data: (conversation) => conversation == null
            ? AppErrorState(message: context.l10n.chatNotFound)
            : Column(
                children: [
                  _RequestStatusBar(requestId: widget.chatId),
                  Expanded(
                    child: _MessagesList(
                      chatId: widget.chatId,
                      viewerRole: widget.role,
                    ),
                  ),
                  _Composer(
                    controller: _controller,
                    sending: _sending,
                    onSend: () => _send(conversation),
                  ),
                ],
              ),
      ),
    );
  }
}

/// The status of the conversation's service request, kept in view.
class _RequestStatusBar extends ConsumerWidget {
  const _RequestStatusBar({required this.requestId});

  final String requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = ref.watch(serviceRequestStreamProvider(requestId)).asData?.value;
    if (request == null) return const SizedBox.shrink();
    final tone = request.status.tone;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: tone.background,
      child: Row(
        children: [
          Icon(Icons.assignment_outlined, size: 18, color: tone.accent),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              context.l10n.serviceRequestStatusLine(
                request.status.label(context.l10n),
              ),
              style: AppTextStyles.captionStrong.copyWith(color: tone.foreground),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessagesList extends ConsumerWidget {
  const _MessagesList({required this.chatId, required this.viewerRole});

  final String chatId;
  final ChatParticipantRole viewerRole;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messagesAsync = ref.watch(chatMessagesProvider(chatId));
    return messagesAsync.when(
      loading: () => const AppLoadingState(),
      error: (_, _) => AppErrorState(
        message: context.l10n.chatLoadFailed,
        onRetry: () => ref.invalidate(chatMessagesProvider(chatId)),
      ),
      data: (messages) {
        if (messages.isEmpty) {
          return AppEmptyState(
            icon: Icons.chat_bubble_outline,
            message: context.l10n.chatEmpty,
            expandVertically: true,
          );
        }
        // Newest at the bottom; the list is reversed so it opens there.
        final newestFirst = messages.reversed.toList();
        return ListView.builder(
          reverse: true,
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.s12,
            AppSpacing.s12,
            AppSpacing.s12,
            AppSpacing.s8,
          ),
          itemCount: newestFirst.length,
          itemBuilder: (context, index) {
            final message = newestFirst[index];
            final older =
                index + 1 < newestFirst.length ? newestFirst[index + 1] : null;
            return MessageBubble(
              message: message,
              isMine: message.senderRole == viewerRole,
              // The name is shown once per run of messages from one side.
              showSender: older == null || older.senderRole != message.senderRole,
            );
          },
        );
      },
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return AppBottomBar(
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
              controller: controller,
              minLines: 1,
              maxLines: 5,
              maxLength: ChatMessage.maxLength,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: context.l10n.chatInputHint,
                counterText: '',
                isDense: true,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.s6),
          IconButton.filled(
            style: IconButton.styleFrom(foregroundColor: AppColors.onPrimary),
            tooltip: context.l10n.chatSend,
            onPressed: sending ? null : onSend,
            icon: sending
                ? const AppSpinner()
                : const Icon(Icons.send_rounded),
          ),
        ],
      ),
    );
  }
}

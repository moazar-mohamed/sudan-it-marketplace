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
import '../domain/job_chat.dart';
import 'job_chat_providers.dart';

/// The conversation between a job's technician and its company. The customer
/// never sees it. [role] says which side the viewer speaks for.
class JobChatScreen extends ConsumerStatefulWidget {
  const JobChatScreen({
    super.key,
    required this.orderId,
    required this.role,
    required this.companyId,
    required this.technicianId,
    required this.technicianName,
    required this.productName,
  });

  final String orderId;
  final JobChatRole role;
  final String companyId;
  final String technicianId;
  final String technicianName;
  final String productName;

  @override
  ConsumerState<JobChatScreen> createState() => _JobChatScreenState();
}

class _JobChatScreenState extends ConsumerState<JobChatScreen> {
  final _controller = TextEditingController();
  bool _sending = false;
  bool _markingRead = false;

  @override
  void initState() {
    super.initState();
    ref.listenManual(
      jobChatProvider(widget.orderId),
      (_, next) => _markReadIfNeeded(next.asData?.value),
      fireImmediately: true,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _markReadIfNeeded(JobChat? chat) async {
    if (chat == null || _markingRead || !chat.isUnreadFor(widget.role)) return;
    _markingRead = true;
    await ref
        .read(jobChatStoreProvider)
        .markRead(orderId: widget.orderId, role: widget.role);
    if (mounted) _markingRead = false;
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    final uid = ref.read(currentUserIdProvider);
    if (text.isEmpty || _sending || uid == null) return;
    setState(() => _sending = true);
    String? error;
    try {
      final messageId = await ref.read(jobChatStoreProvider).send(
            orderId: widget.orderId,
            companyId: widget.companyId,
            technicianId: widget.technicianId,
            technicianName: widget.technicianName,
            productName: widget.productName,
            senderId: uid,
            senderRole: widget.role,
            // The company speaks as itself; its name is shown by role.
            senderName:
                widget.role == JobChatRole.technician ? widget.technicianName : '',
            text: text,
            existing: ref.read(jobChatProvider(widget.orderId)).asData?.value != null,
          );
      // The other side's phones hear about it (in the background).
      unawaited(
        ref.read(pushRelayProvider).jobChatMessage(
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
    final isTechnician = widget.role == JobChatRole.technician;
    final counterpart = isTechnician
        ? l10n.tjChatCompany
        : (widget.technicianName.trim().isEmpty
            ? l10n.tjChatWithTechnician
            : widget.technicianName);
    final messagesAsync = ref.watch(jobChatMessagesProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(counterpart, maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(
              widget.productName,
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
                  Icons.lock_outline,
                  size: 16,
                  color: AppTone.info.accent(context.colors),
                ),
                const SizedBox(width: AppSpacing.s8),
                Expanded(
                  child: Text(
                    l10n.tjChatPrivate,
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
                    ref.invalidate(jobChatMessagesProvider(widget.orderId)),
              ),
              data: (messages) {
                if (messages.isEmpty) {
                  return AppEmptyState(
                    icon: Icons.chat_bubble_outline,
                    message: l10n.tjChatEmpty,
                    expandVertically: true,
                  );
                }
                final newestFirst = messages.reversed.toList();
                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.all(AppSpacing.s12),
                  itemCount: newestFirst.length,
                  itemBuilder: (context, index) {
                    final message = newestFirst[index];
                    final older = index + 1 < newestFirst.length
                        ? newestFirst[index + 1]
                        : null;
                    final fromCompany = message.senderRole == JobChatRole.company;
                    return MessageBubble(
                      message: ChatMessage(
                        id: message.id,
                        senderId: message.senderId,
                        // Only used by the bubble to place and name the side.
                        senderRole: fromCompany
                            ? ChatParticipantRole.company
                            : ChatParticipantRole.customer,
                        senderName: fromCompany
                            ? l10n.tjChatCompany
                            : message.senderName,
                        text: message.text,
                        createdAt: message.createdAt,
                        isPending: message.isPending,
                      ),
                      isMine: message.senderRole == widget.role,
                      showSender: older == null ||
                          older.senderRole != message.senderRole,
                    );
                  },
                );
              },
            ),
          ),
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
                    key: const ValueKey('job-chat-input'),
                    controller: _controller,
                    minLines: 1,
                    maxLines: 5,
                    maxLength: JobChatMessage.maxLength,
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
                  key: const ValueKey('job-chat-send'),
                  style: IconButton.styleFrom(
                    foregroundColor: context.colors.onPrimary,
                  ),
                  tooltip: l10n.chatSend,
                  onPressed: _sending ? null : _send,
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

/// Opens the technician-company conversation of a job; a small unread dot
/// shows on the button when the other side wrote last.
class JobChatButton extends ConsumerWidget {
  const JobChatButton({
    super.key,
    required this.orderId,
    required this.role,
    required this.companyId,
    required this.technicianId,
    required this.technicianName,
    required this.productName,
    this.label,
  });

  final String orderId;
  final JobChatRole role;
  final String companyId;
  final String technicianId;
  final String technicianName;
  final String productName;

  /// With a label it is a full-width button; without, a compact icon button.
  final String? label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chat = ref.watch(jobChatProvider(orderId)).asData?.value;
    final unread = chat?.isUnreadFor(role) ?? false;
    void open() => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => JobChatScreen(
              orderId: orderId,
              role: role,
              companyId: companyId,
              technicianId: technicianId,
              technicianName: technicianName,
              productName: productName,
            ),
          ),
        );

    if (label != null) {
      return Stack(
        children: [
          AppButton.outlined(
            key: const ValueKey('job-chat-open'),
            expand: true,
            icon: Icons.chat_bubble_outline,
            label: label!,
            onPressed: open,
          ),
          if (unread)
            const PositionedDirectional(
              top: 8,
              end: 8,
              child: AppUnreadDot(),
            ),
        ],
      );
    }
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton.outlined(
          key: const ValueKey('job-chat-open'),
          tooltip: context.l10n.tjChatWithCompany,
          icon: const Icon(Icons.chat_bubble_outline),
          onPressed: open,
        ),
        if (unread)
          const PositionedDirectional(top: 6, end: 6, child: AppUnreadDot()),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/entities/chat_conversation.dart';
import 'chat_format.dart';
import 'chat_providers.dart';
import 'chat_screen.dart';

/// The service-request conversations of the signed-in customer, or of a
/// company ([companyId]) when [role] is company.
class ChatsListScreen extends ConsumerWidget {
  const ChatsListScreen({
    super.key,
    required this.role,
    this.companyId = '',
    this.showAppBar = false,
  });

  final ChatParticipantRole role;
  final String companyId;
  final bool showAppBar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = role == ChatParticipantRole.customer
        ? customerChatsStreamProvider
        : companyChatsStreamProvider(companyId);
    final chatsAsync = ref.watch(provider);
    final colorScheme = Theme.of(context).colorScheme;

    final body = chatsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: AppColors.error,
              ),
              const SizedBox(height: 12),
              Text(context.l10n.chatLoadFailed, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => ref.invalidate(provider),
                child: Text(context.l10n.commonRetry),
              ),
            ],
          ),
        ),
      ),
      data: (chats) {
        if (chats.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.chat_bubble_outline,
                    size: 48,
                    color: colorScheme.onSurface.withValues(alpha: 0.35),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    role == ChatParticipantRole.customer
                        ? context.l10n.chatsEmptyCustomer
                        : context.l10n.chatsEmptyCompany,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                          height: 1.45,
                        ),
                  ),
                ],
              ),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: chats.length,
          separatorBuilder: (_, _) => Divider(
            height: 1,
            indent: 76,
            color: colorScheme.onSurface.withValues(alpha: 0.06),
          ),
          itemBuilder: (context, index) =>
              _ChatTile(conversation: chats[index], role: role),
        );
      },
    );

    if (!showAppBar) return body;
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.navChats)),
      body: body,
    );
  }
}

class _ChatTile extends StatelessWidget {
  const _ChatTile({required this.conversation, required this.role});

  final ChatConversation conversation;
  final ChatParticipantRole role;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final colorScheme = theme.colorScheme;
    final unread = conversation.isUnreadFor(role);
    final title = role == ChatParticipantRole.customer
        ? conversation.companyName
        : (conversation.customerName.trim().isEmpty
            ? context.l10n.chatCustomerFallback
            : conversation.customerName.trim());
    final lastText = conversation.lastMessageText?.trim() ?? '';
    final preview = !conversation.hasMessages || lastText.isEmpty
        ? context.l10n.chatNoMessagesYet
        : conversation.lastMessageSenderRole == role
            ? context.l10n.chatYouPrefix(lastText)
            : lastText;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ChatScreen(chatId: conversation.id, role: role),
        ),
      ),
      leading: CircleAvatar(
        radius: 24,
        backgroundColor: AppColors.primary.withValues(alpha: 0.1),
        child: Text(
          title.isNotEmpty ? title.substring(0, 1) : '?',
          style: textTheme.titleMedium?.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: textTheme.titleSmall?.copyWith(
                fontWeight: unread ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatChatTime(context, conversation.activityAt),
            style: textTheme.labelSmall?.copyWith(
              color: unread
                  ? AppColors.primary
                  : colorScheme.onSurface.withValues(alpha: 0.55),
              fontWeight: unread ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ],
      ),
      subtitle: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  conversation.serviceName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.labelSmall?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  preview,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurface
                        .withValues(alpha: unread ? 0.85 : 0.6),
                    fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
          if (unread)
            Semantics(
              label: context.l10n.chatUnread,
              child: Container(
                width: 10,
                height: 10,
                margin: const EdgeInsetsDirectional.only(start: 8),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

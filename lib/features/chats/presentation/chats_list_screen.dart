import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
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

    final body = chatsAsync.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: const [AppSkeletonList()],
      ),
      error: (_, _) => AppErrorState(
        message: context.l10n.chatLoadFailed,
        onRetry: () => ref.invalidate(provider),
      ),
      data: (chats) {
        if (chats.isEmpty) {
          return AppEmptyState(
            icon: Icons.chat_bubble_outline,
            message: role == ChatParticipantRole.customer
                ? context.l10n.chatsEmptyCustomer
                : context.l10n.chatsEmptyCompany,
            expandVertically: true,
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
          itemCount: chats.length,
          separatorBuilder: (_, _) => const Divider(height: 1, indent: 76),
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
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s16,
        vertical: AppSpacing.s4,
      ),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ChatScreen(chatId: conversation.id, role: role),
        ),
      ),
      leading: AppAvatar(name: title, size: 48),
      title: Row(
        children: [
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.bodyStrong.copyWith(
                fontWeight: unread ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.s8),
          Text(
            formatChatTime(context, conversation.activityAt),
            style: AppTextStyles.labelSmall.copyWith(
              color: unread ? AppColors.textBrand : AppColors.textSecondary,
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
                  style: AppTextStyles.labelSmall
                      .copyWith(color: AppColors.textBrand),
                ),
                Text(
                  preview,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    color: unread
                        ? AppColors.textPrimary
                        : AppColors.textSecondary,
                    fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
          if (unread)
            Semantics(
              label: context.l10n.chatUnread,
              child: const Padding(
                padding: EdgeInsetsDirectional.only(start: AppSpacing.s8),
                child: AppUnreadDot(),
              ),
            ),
        ],
      ),
    );
  }
}

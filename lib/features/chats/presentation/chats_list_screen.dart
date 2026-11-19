import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../domain/entities/chat_conversation.dart';
import 'chat_format.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../customer_dashboard/presentation/site/site_orders.dart';
import 'chat_providers.dart';
import 'chat_screen.dart';

/// The conversations (orders, service requests and questions asked before
/// ordering) of the signed-in customer, or of a company ([companyId]) when
/// [role] is company.
class ChatsListScreen extends ConsumerStatefulWidget {
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
  ConsumerState<ChatsListScreen> createState() => _ChatsListScreenState();
}

/// The conversations the customer's search and «غير المقروءة» keep, as on
/// sictm.net: the company, the subject and the last message are searched.
List<ChatConversation> siteNarrowChats(
  List<ChatConversation> chats, {
  required String query,
  required bool unreadOnly,
  required String Function(ChatConversation) subjectOf,
}) {
  final term = query.trim().toLowerCase();
  return [
    for (final c in chats)
      if ((!unreadOnly || c.isUnreadFor(ChatParticipantRole.customer)) &&
          (term.isEmpty ||
              '${c.companyName} ${subjectOf(c)} ${c.lastMessageText ?? ''}'
                  .toLowerCase()
                  .contains(term)))
        c,
  ];
}

class _ChatsListScreenState extends ConsumerState<ChatsListScreen> {
  final _query = TextEditingController();
  bool _unreadOnly = false;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.role;
    final customer = role == ChatParticipantRole.customer;
    final provider = customer
        ? customerChatsStreamProvider
        : companyChatsStreamProvider(widget.companyId);
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
            message: customer
                ? context.l10n.chatsEmptyCustomer
                : context.l10n.chatsEmptyCompany,
            expandVertically: true,
          );
        }
        final shown = customer
            ? siteNarrowChats(
                chats,
                query: _query.text,
                unreadOnly: _unreadOnly,
                subjectOf: (c) => chatSubject(context, c),
              )
            : chats;
        if (shown.isEmpty) {
          return _withHeader(
            context,
            ListView(
              children: [
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.s24),
                  child: Text(
                    context.l10n.siteChatsNoneHere,
                    textAlign: TextAlign.center,
                    style: AppTextStyles.body.copyWith(
                      color: context.colors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          );
        }
        final list = ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
          itemCount: shown.length,
          separatorBuilder: (_, _) => const Divider(height: 1, indent: 76),
          itemBuilder: (context, index) =>
              _ChatTile(conversation: shown[index], role: role),
        );
        return customer ? _withHeader(context, list) : list;
      },
    );

    if (!widget.showAppBar) return body;
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.navChats)),
      body: body,
    );
  }

  /// The customer's list as on sictm.net: the title, a search and «الكل» /
  /// «غير المقروءة» above the conversations.
  Widget _withHeader(BuildContext context, Widget list) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SitePageTitle(context.l10n.navChats),
              const SizedBox(height: 12),
              SitePageSearch(
                controller: _query,
                hint: context.l10n.siteChatsSearch,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  SiteChip(
                    key: const ValueKey('chats-all'),
                    small: true,
                    label: context.l10n.siteAll,
                    selected: !_unreadOnly,
                    onTap: () => setState(() => _unreadOnly = false),
                  ),
                  SiteChip(
                    key: const ValueKey('chats-unread'),
                    small: true,
                    label: context.l10n.siteChatsUnread,
                    selected: _unreadOnly,
                    onTap: () => setState(() => _unreadOnly = true),
                  ),
                ],
              ),
            ],
          ),
        ),
        Expanded(child: list),
      ],
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
              color: unread
                  ? context.colors.textBrand
                  : context.colors.textSecondary,
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
                  chatSubject(context, conversation),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.labelSmall.copyWith(
                    color: context.colors.textBrand,
                  ),
                ),
                Text(
                  preview,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    color: unread
                        ? context.colors.textPrimary
                        : context.colors.textSecondary,
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

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../domain/entities/chat_conversation.dart';
import 'chat_providers.dart';
import '../../../core/logging/debug_log.dart';

final chatActionsProvider = Provider<ChatActions>((ref) => ChatActions(ref));

/// Writes made from the chat screens. Methods return null on success or a
/// user-facing error message.
class ChatActions {
  ChatActions(this._ref);

  final Ref _ref;

  Future<String?> send({
    required ChatConversation conversation,
    required ChatParticipantRole role,
    required String text,
  }) async {
    final senderId = _ref.read(currentUserIdProvider);
    if (senderId == null) {
      return _ref.read(appLocalizationsProvider).errorPermissionDenied;
    }
    // A company speaks under its company name; the customer under the name
    // saved on the request.
    final senderName = role == ChatParticipantRole.company
        ? conversation.companyName
        : conversation.customerName;
    try {
      await _ref.read(chatsRepositoryProvider).sendMessage(
            chatId: conversation.id,
            senderId: senderId,
            senderRole: role,
            senderName: senderName,
            text: text,
          );
      return null;
    } catch (error) {
      return localizedErrorMessage(_ref.read(appLocalizationsProvider), error);
    }
  }

  /// Best effort: a failure only leaves the unread badge on until the
  /// conversation is opened again.
  Future<void> markRead({
    required String chatId,
    required ChatParticipantRole role,
  }) async {
    try {
      await _ref
          .read(chatsRepositoryProvider)
          .markRead(chatId: chatId, role: role);
    } catch (error) {
      debugLog('ChatActions', 'Could not mark chat $chatId as read: $error');
    }
  }
}

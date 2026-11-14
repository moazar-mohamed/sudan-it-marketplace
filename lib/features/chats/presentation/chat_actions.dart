import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/entities/chat_conversation.dart';
import '../domain/repositories/chats_repository.dart';
import 'chat_providers.dart';
import '../../../core/logging/debug_log.dart';

final chatActionsProvider = Provider<ChatActions>((ref) => ChatActions(ref));

typedef ChatOpenResult = ({String? chatId, String? error});

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

  /// Opens the signed-in customer's conversation with [companyId] about one
  /// product, before any order (the "Contact" button on a product page).
  Future<ChatOpenResult> openProductInquiry({
    required String companyId,
    required String companyName,
    required String productId,
    required String productName,
  }) {
    return _openInquiry(
      (repository, customerId, customerName) => repository.openProductInquiry(
        customerId: customerId,
        customerName: customerName,
        companyId: companyId,
        companyName: companyName,
        productId: productId,
        productName: productName,
      ),
    );
  }

  /// The same for one company's offer of a service ([companyServiceId]).
  Future<ChatOpenResult> openServiceInquiry({
    required String companyId,
    required String companyName,
    required String companyServiceId,
    required String serviceName,
  }) {
    return _openInquiry(
      (repository, customerId, customerName) => repository.openServiceInquiry(
        customerId: customerId,
        customerName: customerName,
        companyId: companyId,
        companyName: companyName,
        companyServiceId: companyServiceId,
        serviceName: serviceName,
      ),
    );
  }

  Future<ChatOpenResult> _openInquiry(
    Future<String> Function(
      ChatsRepository repository,
      String customerId,
      String customerName,
    ) open,
  ) async {
    final customerId = _ref.read(currentUserIdProvider);
    if (customerId == null) {
      return (
        chatId: null,
        error: _ref.read(appLocalizationsProvider).errorPermissionDenied,
      );
    }
    try {
      final chatId = await open(
        _ref.read(chatsRepositoryProvider),
        customerId,
        await _customerName(customerId),
      );
      return (chatId: chatId, error: null);
    } catch (error) {
      return (
        chatId: null,
        error: localizedErrorMessage(_ref.read(appLocalizationsProvider), error),
      );
    }
  }

  /// The name the company sees; a conversation still opens without one.
  Future<String> _customerName(String customerId) async {
    try {
      final profile = await _ref
          .read(userProfileRepositoryProvider)
          .fetchProfile(customerId);
      return profile?.fullName ?? '';
    } catch (error) {
      debugLog('ChatActions', 'Could not load the customer name: $error');
      return '';
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

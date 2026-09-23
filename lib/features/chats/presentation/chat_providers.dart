import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_state.dart';
import '../data/datasources/chats_remote_data_source.dart';
import '../data/datasources/firestore_chats_remote_data_source.dart';
import '../data/repositories/chats_repository_impl.dart';
import '../domain/entities/chat_conversation.dart';
import '../domain/entities/chat_message.dart';
import '../domain/repositories/chats_repository.dart';

final chatsRemoteDataSourceProvider = Provider<ChatsRemoteDataSource>((ref) {
  return FirestoreChatsRemoteDataSource();
});

final chatsRepositoryProvider = Provider<ChatsRepository>((ref) {
  return ChatsRepositoryImpl(ref.watch(chatsRemoteDataSourceProvider));
});

/// The signed-in user's id (null when signed out).
final currentUserIdProvider = Provider<String?>((ref) {
  final authState = ref.watch(authControllerProvider);
  return switch (authState) {
    AuthAuthenticated(:final user) => user.id,
    _ => FirebaseAuth.instance.currentUser?.uid,
  };
});

/// The signed-in customer's conversations, most recent activity first.
final customerChatsStreamProvider =
    StreamProvider<List<ChatConversation>>((ref) {
  final customerId = ref.watch(currentUserIdProvider);
  if (customerId == null || customerId.isEmpty) {
    return Stream.value(const []);
  }
  return ref.watch(chatsRepositoryProvider).watchCustomerConversations(
        customerId,
      );
});

/// The conversations of every service request sent to [companyId].
final companyChatsStreamProvider =
    StreamProvider.family<List<ChatConversation>, String>((ref, companyId) {
  if (companyId.isEmpty) {
    return Stream.value(const []);
  }
  return ref
      .watch(chatsRepositoryProvider)
      .watchCompanyConversations(companyId);
});

final chatConversationProvider =
    StreamProvider.family<ChatConversation?, String>((ref, chatId) {
  return ref.watch(chatsRepositoryProvider).watchConversation(chatId);
});

final chatMessagesProvider =
    StreamProvider.family<List<ChatMessage>, String>((ref, chatId) {
  return ref.watch(chatsRepositoryProvider).watchMessages(chatId);
});

/// How many of the customer's conversations have a message they have not
/// read yet (0 while loading or on error).
final customerUnreadChatsCountProvider = Provider<int>((ref) {
  final chats = ref.watch(customerChatsStreamProvider).asData?.value;
  return _unreadCount(chats, ChatParticipantRole.customer);
});

final companyUnreadChatsCountProvider =
    Provider.family<int, String>((ref, companyId) {
  final chats = ref.watch(companyChatsStreamProvider(companyId)).asData?.value;
  return _unreadCount(chats, ChatParticipantRole.company);
});

int _unreadCount(List<ChatConversation>? chats, ChatParticipantRole role) =>
    chats?.where((chat) => chat.isUnreadFor(role)).length ?? 0;

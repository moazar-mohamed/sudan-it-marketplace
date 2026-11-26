import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/tech_chat_store.dart';
import '../domain/tech_chat.dart';

final techChatStoreProvider = Provider<TechChatStore>((ref) => TechChatStore());

final techChatProvider =
    StreamProvider.autoDispose.family<TechChat?, String>((ref, orderId) {
  if (orderId.isEmpty) return Stream.value(null);
  return ref.watch(techChatStoreProvider).watchChat(orderId);
});

final techChatMessagesProvider =
    StreamProvider.autoDispose.family<List<TechChatMessage>, String>((ref, orderId) {
  if (orderId.isEmpty) return Stream.value(const []);
  return ref.watch(techChatStoreProvider).watchMessages(orderId);
});

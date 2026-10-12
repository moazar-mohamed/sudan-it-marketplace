import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/job_chat_store.dart';
import '../domain/job_chat.dart';

final jobChatStoreProvider = Provider<JobChatStore>((ref) => JobChatStore());

final jobChatProvider = StreamProvider.family<JobChat?, String>((ref, orderId) {
  if (orderId.isEmpty) return Stream.value(null);
  return ref.watch(jobChatStoreProvider).watchChat(orderId);
});

final jobChatMessagesProvider =
    StreamProvider.family<List<JobChatMessage>, String>((ref, orderId) {
  if (orderId.isEmpty) return Stream.value(const []);
  return ref.watch(jobChatStoreProvider).watchMessages(orderId);
});

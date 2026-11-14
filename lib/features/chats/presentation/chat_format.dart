import 'package:flutter/widgets.dart';

import '../../../core/localization/l10n_extension.dart';
import '../domain/entities/chat_conversation.dart';

/// What a conversation is about, as its header and list entry show it: a
/// question asked before ordering says so ("Question: Router"), so it is not
/// mistaken for the conversation of an order of the same product.
String chatSubject(BuildContext context, ChatConversation conversation) =>
    conversation.isInquiry
        ? context.l10n.chatInquirySubject(conversation.subjectLabel)
        : conversation.subjectLabel;

/// "14:05" for today, "Yesterday 14:05", otherwise "2026-09-21 14:05"
/// (local time), in the active language.
String formatChatTime(BuildContext context, DateTime value, {DateTime? now}) {
  final local = value.toLocal();
  final today = now ?? DateTime.now();
  String two(int n) => n.toString().padLeft(2, '0');
  final time = '${two(local.hour)}:${two(local.minute)}';
  final day = DateTime(local.year, local.month, local.day);
  final todayDay = DateTime(today.year, today.month, today.day);
  final difference = todayDay.difference(day).inDays;
  if (difference == 0) return time;
  if (difference == 1) return context.l10n.chatYesterdayAt(time);
  return '${local.year}-${two(local.month)}-${two(local.day)} $time';
}

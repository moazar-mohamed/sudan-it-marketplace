import 'package:flutter/widgets.dart';

import '../../../core/localization/l10n_extension.dart';

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

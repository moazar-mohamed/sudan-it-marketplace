import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/chat_message.dart';
import '../chat_format.dart';

/// One message: the viewer's own on the end side, the other side's on the
/// start side (so it follows RTL/LTR), with the sender and the time.
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.isMine,
    required this.showSender,
    this.mineLabel,
    this.readByOther,
  });

  final ChatMessage message;
  final bool isMine;
  final bool showSender;

  /// The name over an end-side message instead of "You" (a reader who is
  /// not one of the two sides shows one side's name there).
  final String? mineLabel;

  /// On the viewer's own sent message: ✓ when sent, ✓✓ once the other side
  /// has read it (as sictm.net shows «قرأتها الشركة»). Null shows no tick.
  final bool? readByOther;

  @override
  Widget build(BuildContext context) {
    final background = isMine ? context.colors.primary : context.colors.bgMuted;
    final foreground = isMine
        ? context.colors.onPrimary
        : context.colors.textPrimary;
    final meta = isMine
        ? context.colors.onPrimary
        : context.colors.textSecondary;
    final sender = isMine
        ? (mineLabel ?? context.l10n.chatYou)
        : (message.senderName.trim().isEmpty
              ? context.l10n.chatCustomerFallback
              : message.senderName.trim());
    const radius = Radius.circular(AppRadius.md);

    return Padding(
      padding: EdgeInsets.only(top: showSender ? 10 : 3),
      child: Column(
        crossAxisAlignment: isMine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          if (showSender)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              child: Text(
                sender,
                style: AppTextStyles.labelSmall.copyWith(
                  color: context.colors.textSecondary,
                ),
              ),
            ),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width * 0.78,
            ),
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
              decoration: BoxDecoration(
                color: background,
                borderRadius: BorderRadiusDirectional.only(
                  topStart: radius,
                  topEnd: radius,
                  bottomStart: isMine ? radius : const Radius.circular(4),
                  bottomEnd: isMine ? const Radius.circular(4) : radius,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  SelectableText(
                    message.text,
                    style: AppTextStyles.body.copyWith(color: foreground),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        formatChatTime(context, message.createdAt),
                        textDirection: TextDirection.ltr,
                        style: AppTextStyles.labelSmall.copyWith(color: meta),
                      ),
                      if (isMine && message.isPending) ...[
                        const SizedBox(width: 4),
                        Icon(Icons.schedule, size: 12, color: meta),
                      ] else if (isMine && readByOther != null) ...[
                        const SizedBox(width: 6),
                        Semantics(
                          label: readByOther!
                              ? context.l10n.siteChatReadByCompany
                              : context.l10n.siteChatSent,
                          child: ExcludeSemantics(
                            child: Text(
                              readByOther! ? '✓✓' : '✓',
                              key: const ValueKey('message-tick'),
                              style: AppTextStyles.labelSmall.copyWith(
                                color: readByOther!
                                    ? const Color(0xFF7BD3F2)
                                    : meta,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

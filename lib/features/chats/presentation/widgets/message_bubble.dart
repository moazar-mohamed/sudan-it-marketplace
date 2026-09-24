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
  });

  final ChatMessage message;
  final bool isMine;
  final bool showSender;

  @override
  Widget build(BuildContext context) {
    final background = isMine ? AppColors.primary : AppColors.bgMuted;
    final foreground = isMine ? AppColors.onPrimary : AppColors.textPrimary;
    final meta = isMine ? AppColors.onPrimary : AppColors.textSecondary;
    final sender = isMine
        ? context.l10n.chatYou
        : (message.senderName.trim().isEmpty
            ? context.l10n.chatCustomerFallback
            : message.senderName.trim());
    const radius = Radius.circular(AppRadius.md);

    return Padding(
      padding: EdgeInsets.only(top: showSender ? 10 : 3),
      child: Column(
        crossAxisAlignment:
            isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (showSender)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              child: Text(
                sender,
                style: AppTextStyles.labelSmall
                    .copyWith(color: AppColors.textSecondary),
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
                        Icon(
                          Icons.schedule,
                          size: 12,
                          color: meta,
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../domain/entities/chat_conversation.dart';
import '../chat_actions.dart';
import '../chat_screen.dart';

/// "Contact": opens the customer's conversation with a company about the
/// product or service on screen, before ordering anything. The first tap
/// creates the conversation; later taps reopen the same one.
class ContactCompanyButton extends ConsumerStatefulWidget {
  ContactCompanyButton.product({
    super.key,
    required String companyId,
    required String companyName,
    required String productId,
    required String productName,
    this.primary = false,
  }) : _open = ((actions) => actions.openProductInquiry(
              companyId: companyId,
              companyName: companyName,
              productId: productId,
              productName: productName,
            ));

  ContactCompanyButton.service({
    super.key,
    required String companyId,
    required String companyName,
    required String companyServiceId,
    required String serviceName,
    this.primary = false,
  }) : _open = ((actions) => actions.openServiceInquiry(
              companyId: companyId,
              companyName: companyName,
              companyServiceId: companyServiceId,
              serviceName: serviceName,
            ));

  /// Filled when it is the main action left (nothing can be bought or
  /// requested right now), outlined next to one otherwise.
  final bool primary;
  final Future<ChatOpenResult> Function(ChatActions actions) _open;

  @override
  ConsumerState<ContactCompanyButton> createState() =>
      _ContactCompanyButtonState();
}

class _ContactCompanyButtonState extends ConsumerState<ContactCompanyButton> {
  bool _opening = false;

  Future<void> _contact() async {
    setState(() => _opening = true);
    final result = await widget._open(ref.read(chatActionsProvider));
    if (!mounted) return;
    setState(() => _opening = false);
    final chatId = result.chatId;
    if (chatId == null) {
      showAppSnackBar(
        context,
        result.error ?? context.l10n.chatStartFailed,
        tone: AppTone.error,
      );
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChatScreen(
          chatId: chatId,
          role: ChatParticipantRole.customer,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppButton(
      variant: widget.primary
          ? AppButtonVariant.primary
          : AppButtonVariant.outlined,
      icon: Icons.chat_bubble_outline,
      label: context.l10n.chatContactCompany,
      loading: _opening,
      expand: true,
      onPressed: _contact,
    );
  }
}

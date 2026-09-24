import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/presentation/chat_screen.dart';
import '../../location/presentation/location_strings.dart';
import '../../location/presentation/widgets/open_location_button.dart';
import '../domain/entities/service_request.dart';
import 'service_request_actions.dart';
import 'service_request_labels.dart';
import 'service_request_providers.dart';

/// One service request, as its customer or its company ([asCompany]) sees
/// it, with the actions that side may take next.
class ServiceRequestDetailsScreen extends ConsumerWidget {
  const ServiceRequestDetailsScreen({
    super.key,
    required this.requestId,
    required this.asCompany,
    this.showChatAction = true,
  });

  final String requestId;
  final bool asCompany;

  /// False when opened from the conversation itself.
  final bool showChatAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestAsync = ref.watch(serviceRequestStreamProvider(requestId));
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.serviceRequestDetailsTitle)),
      body: requestAsync.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => AppErrorState(
          message: context.l10n.serviceRequestsLoadFailed,
          onRetry: () => ref.invalidate(serviceRequestStreamProvider(requestId)),
        ),
        data: (request) => request == null
            ? AppErrorState(message: context.l10n.serviceRequestNotFound)
            : _Details(
                request: request,
                asCompany: asCompany,
                showChatAction: showChatAction,
              ),
      ),
    );
  }
}

/// The steps a request moves through when it goes well. A rejected or
/// cancelled request left that path, so it shows its own status instead.
const _happyPath = [
  ServiceRequestStatus.pending,
  ServiceRequestStatus.accepted,
  ServiceRequestStatus.inProgress,
  ServiceRequestStatus.completed,
];

class _Details extends StatelessWidget {
  const _Details({
    required this.request,
    required this.asCompany,
    required this.showChatAction,
  });

  final ServiceRequest request;
  final bool asCompany;
  final bool showChatAction;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final price = request.price;
    final locationLabel = LocationStrings.of(context).viewOnMap;
    final step = _happyPath.indexOf(request.status);
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return ListView(
      padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SectionCard(
                  title: request.serviceName,
                  trailing: StatusChip(
                    label: request.status.label(l10n),
                    tone: request.status.tone,
                  ),
                  children: [
                    // Progress is shown for the normal path only.
                    if (step >= 0) ...[
                      AppStepTracker(
                        labels: [
                          for (final status in _happyPath) status.label(l10n),
                        ],
                        currentIndex: step,
                        allDone: request.status == ServiceRequestStatus.completed,
                      ),
                      const SizedBox(height: AppSpacing.s12),
                      const Divider(height: 1),
                      const SizedBox(height: AppSpacing.s8),
                    ],
                    KeyValueRow(
                      label: asCompany
                          ? l10n.serviceRequestCustomer
                          : l10n.serviceRequestCompany,
                      value: asCompany
                          ? (request.customerName.trim().isEmpty
                              ? l10n.chatCustomerFallback
                              : request.customerName)
                          : request.companyName,
                    ),
                    // Only a price the company actually set is shown.
                    if (price != null)
                      KeyValueRow(
                        label: l10n.serviceRequestPrice,
                        value: formatServicePrice(price),
                        emphasize: true,
                      ),
                    KeyValueRow(
                      label: l10n.serviceRequestSentAt,
                      value: formatServiceDate(request.createdAt),
                      valueTextDirection: TextDirection.ltr,
                    ),
                    KeyValueRow(
                      label: l10n.serviceRequestNumber,
                      value: '#${request.shortId}',
                      valueTextDirection: TextDirection.ltr,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.s12),
                SectionCard(
                  title: l10n.serviceRequestViewDetails,
                  children: [
                    SelectableText(request.details, style: AppTextStyles.body),
                  ],
                ),
                const SizedBox(height: AppSpacing.s12),
                SectionCard(
                  title: l10n.serviceRequestContact,
                  children: [
                    KeyValueRow(
                      label: l10n.checkoutContactPhone,
                      value: request.contactPhone,
                      valueTextDirection: TextDirection.ltr,
                    ),
                    if (request.addressText != null)
                      KeyValueRow(
                        label: l10n.serviceRequestAddress,
                        value: request.addressText!,
                      ),
                    if (request.hasLocation) ...[
                      const SizedBox(height: AppSpacing.s8),
                      OpenLocationButton(
                        label: locationLabel,
                        viewerTitle: locationLabel,
                        coordinates: request.coordinates,
                        text: request.addressText,
                        allowTextSearch: true,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.s16),
                if (asCompany)
                  _CompanyActions(request: request)
                else if (request.canCustomerCancel)
                  _CustomerCancel(request: request),
                if (showChatAction) ...[
                  const SizedBox(height: AppSpacing.s8),
                  AppButton.outlined(
                    icon: Icons.chat_bubble_outline,
                    label: l10n.serviceRequestOpenChat,
                    expand: true,
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ChatScreen(
                          chatId: request.id,
                          role: asCompany
                              ? ChatParticipantRole.company
                              : ChatParticipantRole.customer,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Runs a status change and reports a failure; the screen updates itself
/// from the live request when it succeeds.
Future<void> _changeStatus(
  BuildContext context,
  WidgetRef ref,
  ServiceRequest request,
  ServiceRequestStatus status,
) async {
  final error = await ref
      .read(serviceRequestActionsProvider)
      .updateStatus(request, status);
  if (error != null && context.mounted) {
    showAppSnackBar(context, error, tone: AppTone.error);
  }
}

class _CustomerCancel extends ConsumerWidget {
  const _CustomerCancel({required this.request});

  final ServiceRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return AppButton.destructiveOutlined(
      icon: Icons.close_rounded,
      label: l10n.serviceRequestCancel,
      expand: true,
      onPressed: () async {
        final ok = await showConfirmationDialog(
          context,
          title: l10n.serviceRequestCancelTitle,
          body: l10n.serviceRequestCancelBody,
          confirmLabel: l10n.serviceRequestCancel,
          destructive: true,
        );
        if (ok && context.mounted) {
          await _changeStatus(
            context,
            ref,
            request,
            ServiceRequestStatus.cancelled,
          );
        }
      },
    );
  }
}

/// The company moves the request forward: accept or reject a pending one,
/// start an accepted one, complete one in progress.
class _CompanyActions extends ConsumerWidget {
  const _CompanyActions({required this.request});

  final ServiceRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    Widget primary(String label, ServiceRequestStatus next) => AppButton.primary(
          label: label,
          expand: true,
          onPressed: () => _changeStatus(context, ref, request, next),
        );

    return switch (request.status) {
      ServiceRequestStatus.pending => Row(
          children: [
            Expanded(
              child: AppButton.destructiveOutlined(
                label: l10n.serviceRequestReject,
                onPressed: () async {
                  final ok = await showConfirmationDialog(
                    context,
                    title: l10n.serviceRequestRejectTitle,
                    body: l10n.serviceRequestRejectBody,
                    confirmLabel: l10n.serviceRequestReject,
                    destructive: true,
                  );
                  if (ok && context.mounted) {
                    await _changeStatus(
                      context,
                      ref,
                      request,
                      ServiceRequestStatus.rejected,
                    );
                  }
                },
              ),
            ),
            const SizedBox(width: AppSpacing.s12),
            Expanded(
              child: primary(
                l10n.serviceRequestAccept,
                ServiceRequestStatus.accepted,
              ),
            ),
          ],
        ),
      ServiceRequestStatus.accepted =>
        primary(l10n.serviceRequestStart, ServiceRequestStatus.inProgress),
      ServiceRequestStatus.inProgress =>
        primary(l10n.serviceRequestComplete, ServiceRequestStatus.completed),
      _ => const SizedBox.shrink(),
    };
  }
}

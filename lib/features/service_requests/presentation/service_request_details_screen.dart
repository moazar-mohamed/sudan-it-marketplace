import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/presentation/chat_screen.dart';
import '../../company_admin/presentation/widgets/admin_section_card.dart';
import '../../company_admin/presentation/widgets/status_badge.dart';
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
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => AdminErrorState(
          message: context.l10n.serviceRequestsLoadFailed,
          onRetry: () => ref.invalidate(serviceRequestStreamProvider(requestId)),
        ),
        data: (request) => request == null
            ? AdminErrorState(message: context.l10n.serviceRequestNotFound)
            : _Details(
                request: request,
                asCompany: asCompany,
                showChatAction: showChatAction,
              ),
      ),
    );
  }
}

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

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        AdminSectionCard(
          title: request.serviceName,
          trailing: StatusBadge(
            label: request.status.label(l10n),
            color: request.status.color,
          ),
          children: [
            AdminInfoRow(
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
              AdminInfoRow(
                label: l10n.serviceRequestPrice,
                value: formatServicePrice(price),
                emphasize: true,
              ),
            AdminInfoRow(
              label: l10n.serviceRequestSentAt,
              value: formatServiceDate(request.createdAt),
            ),
            AdminInfoRow(
              label: l10n.serviceRequestNumber,
              value: '#${request.shortId}',
            ),
          ],
        ),
        const SizedBox(height: 12),
        AdminSectionCard(
          title: l10n.serviceRequestViewDetails,
          children: [
            SelectableText(
              request.details,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    height: 1.5,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        AdminSectionCard(
          title: l10n.serviceRequestContact,
          children: [
            AdminInfoRow(
              label: l10n.checkoutContactPhone,
              value: request.contactPhone,
            ),
            if (request.addressText != null)
              AdminInfoRow(
                label: l10n.serviceRequestAddress,
                value: request.addressText!,
              ),
            if (request.hasLocation) ...[
              const SizedBox(height: 8),
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
        const SizedBox(height: 16),
        if (asCompany)
          _CompanyActions(request: request)
        else if (request.canCustomerCancel)
          _CustomerCancel(request: request),
        if (showChatAction) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            icon: const Icon(Icons.chat_bubble_outline),
            label: Text(l10n.serviceRequestOpenChat),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
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
    );
  }
}

Future<bool> _confirm(
  BuildContext context, {
  required String title,
  required String body,
  required String confirmLabel,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(context.l10n.commonCancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
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
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
  }
}

class _CustomerCancel extends ConsumerWidget {
  const _CustomerCancel({required this.request});

  final ServiceRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return OutlinedButton.icon(
      icon: const Icon(Icons.close_rounded),
      label: Text(l10n.serviceRequestCancel),
      style: OutlinedButton.styleFrom(
        foregroundColor: Theme.of(context).colorScheme.error,
        minimumSize: const Size.fromHeight(48),
      ),
      onPressed: () async {
        final ok = await _confirm(
          context,
          title: l10n.serviceRequestCancelTitle,
          body: l10n.serviceRequestCancelBody,
          confirmLabel: l10n.serviceRequestCancel,
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
    Widget primary(String label, ServiceRequestStatus next) => FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed: () => _changeStatus(context, ref, request, next),
          child: Text(label),
        );

    return switch (request.status) {
      ServiceRequestStatus.pending => Row(
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () async {
                  final ok = await _confirm(
                    context,
                    title: l10n.serviceRequestRejectTitle,
                    body: l10n.serviceRequestRejectBody,
                    confirmLabel: l10n.serviceRequestReject,
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
                child: Text(l10n.serviceRequestReject),
              ),
            ),
            const SizedBox(width: 12),
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

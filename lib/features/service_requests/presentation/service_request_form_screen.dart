import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/presentation/chat_screen.dart';
import '../../companies/domain/entities/company.dart';
import '../../company_services/domain/entities/company_service.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../location/domain/geo_location.dart';
import '../../location/presentation/widgets/location_field.dart';
import '../../services/domain/entities/catalog_service.dart';
import 'service_request_actions.dart';
import 'service_request_labels.dart';

/// The customer describes what they need and sends the request to one
/// company. On success the request's conversation opens.
class ServiceRequestFormScreen extends ConsumerStatefulWidget {
  const ServiceRequestFormScreen({
    super.key,
    required this.service,
    required this.offer,
    required this.company,
  });

  final CatalogService service;
  final CompanyService offer;
  final Company company;

  @override
  ConsumerState<ServiceRequestFormScreen> createState() =>
      _ServiceRequestFormScreenState();
}

class _ServiceRequestFormScreenState
    extends ConsumerState<ServiceRequestFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _detailsController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  GeoLocation? _location;
  bool _submitting = false;
  bool _phonePrefilled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _prefillPhone();
    });
  }

  @override
  void dispose() {
    _detailsController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _prefillPhone() {
    if (_phonePrefilled) return;
    final phone =
        ref.read(profileControllerProvider).asData?.value?.phone?.trim() ?? '';
    if (phone.isEmpty) return;
    _phonePrefilled = true;
    if (_phoneController.text.isEmpty) _phoneController.text = phone;
  }

  Future<void> _submit() async {
    if (_submitting || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    final result = await ref.read(serviceRequestActionsProvider).submit(
          service: widget.service,
          offer: widget.offer,
          company: widget.company,
          details: _detailsController.text,
          address: _addressController.text,
          location: _location,
          contactPhone: _phoneController.text,
        );
    if (!mounted) return;
    setState(() => _submitting = false);
    final requestId = result.requestId;
    if (requestId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? context.l10n.errorGeneric)),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10n.serviceRequestSent)),
    );
    // The conversation shares the request's id.
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => ChatScreen(
          chatId: requestId,
          role: ChatParticipantRole.customer,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(profileControllerProvider, (_, _) => _prefillPhone());
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final colorScheme = theme.colorScheme;
    final price = widget.offer.price;

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.serviceRequestFormTitle)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.service.name,
                    style: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.company.name,
                    style: textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.7),
                    ),
                  ),
                  // Only a price the company actually set is shown.
                  if (price != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      formatServicePrice(price),
                      style: textTheme.titleSmall?.copyWith(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _detailsController,
              minLines: 4,
              maxLines: 8,
              maxLength: 2000,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                labelText: context.l10n.serviceRequestDetailsLabel,
                hintText: context.l10n.serviceRequestDetailsHint,
                alignLabelWithHint: true,
              ),
              validator: (value) => (value?.trim().isEmpty ?? true)
                  ? context.l10n.serviceRequestDetailsRequired
                  : null,
            ),
            const SizedBox(height: 12),
            LocationField(
              textController: _addressController,
              location: _location,
              textLabel: context.l10n.serviceRequestLocationOptional,
              textHint: context.l10n.serviceRequestAddressHint,
              onLocationChanged: (value) => setState(() => _location = value),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
              ],
              decoration: InputDecoration(
                labelText: context.l10n.checkoutContactPhone,
                hintText: '+249 9X XXX XXXX',
                prefixIcon: const Icon(Icons.phone_outlined),
              ),
              validator: (value) {
                final phone = value?.trim() ?? '';
                if (phone.isEmpty) return context.l10n.checkoutPhoneRequired;
                final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
                if (digits.length < 9 || phone.length > 30) {
                  return context.l10n.commonPhoneInvalid;
                }
                return null;
              },
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.4),
                    )
                  : Text(context.l10n.serviceRequestSubmit),
            ),
          ],
        ),
      ),
    );
  }
}

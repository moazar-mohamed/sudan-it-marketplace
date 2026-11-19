import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../customer_dashboard/presentation/site/site_orders.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/presentation/chat_screen.dart';
import '../../cities/presentation/city_tags.dart';
import '../../companies/domain/entities/company.dart';
import '../../company_services/domain/entities/company_service.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../location/domain/geo_location.dart';
import '../../location/presentation/widgets/location_field.dart';
import '../../services/domain/entities/catalog_service.dart';
import 'service_request_actions.dart';

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
  final _phoneController = PhoneController();
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
    if (_phoneController.number.isEmpty) _phoneController.text = phone;
  }

  Future<void> _submit() async {
    if (_submitting || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    final result = await ref
        .read(serviceRequestActionsProvider)
        .submit(
          service: widget.service,
          offer: widget.offer,
          company: widget.company,
          details: _detailsController.text,
          address: _addressController.text,
          location: _location,
          contactPhone: _phoneController.value,
        );
    if (!mounted) return;
    setState(() => _submitting = false);
    final requestId = result.requestId;
    if (requestId == null) {
      showAppSnackBar(
        context,
        result.error ?? context.l10n.errorGeneric,
        tone: AppTone.error,
      );
      return;
    }
    showAppSnackBar(
      context,
      context.l10n.serviceRequestSent,
      tone: AppTone.success,
    );
    // The conversation shares the request's id.
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) =>
            ChatScreen(chatId: requestId, role: ChatParticipantRole.customer),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(profileControllerProvider, (_, _) => _prefillPhone());
    final l10n = context.l10n;
    final colors = context.colors;
    final price = widget.offer.price;

    // Laid out as sictm.net's «طلب خدمة» (`pages/ServiceRequestPage.tsx`).
    final blocks = <Widget>[
      SitePageTitle(l10n.serviceRequestFormTitle),
      SiteTile(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SiteTileTitle(widget.service.name),
            Text(
              widget.company.name,
              style: AppTextStyles.caption.copyWith(
                fontSize: 13,
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            // Only a price the company actually set is shown.
            if (price != null)
              SitePriceText(pricing: widget.offer)
            else
              Text(
                l10n.sitePriceOnRequest,
                style: AppTextStyles.bodyStrong.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: colors.textBrand,
                ),
              ),
          ],
        ),
      ),
      SiteTile(
        child: AppTextField(
          label: l10n.serviceRequestDetailsLabel,
          controller: _detailsController,
          minLines: 4,
          maxLines: 8,
          maxLength: 2000,
          textInputAction: TextInputAction.newline,
          hint: l10n.serviceRequestDetailsHint,
          validator: (value) => (value?.trim().isEmpty ?? true)
              ? l10n.serviceRequestDetailsRequired
              : null,
        ),
      ),
      SiteTile(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SiteTileTitle(l10n.siteRequestCityPlace),
            const SizedBox(height: 16),
            // The city the service is wanted in, own city by default.
            DeliveryCityRow(companyId: widget.company.id),
            const SizedBox(height: 16),
            LocationField(
              textController: _addressController,
              location: _location,
              textLabel: l10n.serviceRequestLocationOptional,
              textHint: l10n.serviceRequestAddressHint,
              onLocationChanged: (value) => setState(() => _location = value),
            ),
            const SizedBox(height: 16),
            PhoneField(
              label: l10n.checkoutContactPhone,
              controller: _phoneController,
              requiredMessage: l10n.checkoutPhoneRequired,
            ),
          ],
        ),
      ),
      AppButton.primary(
        label: l10n.serviceRequestSubmit,
        loading: _submitting,
        expand: true,
        onPressed: _submit,
      ),
    ];

    return Scaffold(
      appBar: AppBar(),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < blocks.length; i++) ...[
                      if (i > 0) const SizedBox(height: 16),
                      blocks[i],
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

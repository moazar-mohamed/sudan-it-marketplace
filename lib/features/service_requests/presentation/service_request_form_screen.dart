import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
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
    final price = widget.offer.price;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.serviceRequestFormTitle)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AppCard(
                      padding: const EdgeInsets.all(AppSpacing.s16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.service.name, style: AppTextStyles.h3),
                          Text(
                            widget.company.name,
                            style: AppTextStyles.body
                                .copyWith(color: AppColors.textSecondary),
                          ),
                          // Only a price the company actually set is shown.
                          if (price != null) ...[
                            const SizedBox(height: AppSpacing.s6),
                            Text(
                              formatServicePrice(price),
                              style: AppTextStyles.bodyStrong
                                  .copyWith(color: AppColors.textBrand),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.s20),
                    AppTextField(
                      label: context.l10n.serviceRequestDetailsLabel,
                      controller: _detailsController,
                      minLines: 4,
                      maxLines: 8,
                      maxLength: 2000,
                      textInputAction: TextInputAction.newline,
                      hint: context.l10n.serviceRequestDetailsHint,
                      validator: (value) => (value?.trim().isEmpty ?? true)
                          ? context.l10n.serviceRequestDetailsRequired
                          : null,
                    ),
                    const SizedBox(height: AppSpacing.s12),
                    LocationField(
                      textController: _addressController,
                      location: _location,
                      textLabel: context.l10n.serviceRequestLocationOptional,
                      textHint: context.l10n.serviceRequestAddressHint,
                      onLocationChanged: (value) =>
                          setState(() => _location = value),
                    ),
                    const SizedBox(height: AppSpacing.s16),
                    AppTextField(
                      label: context.l10n.checkoutContactPhone,
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
                      ],
                      hint: '‎+249 9X XXX XXXX',
                      prefixIcon: Icons.phone_outlined,
                      validator: (value) {
                        final phone = value?.trim() ?? '';
                        if (phone.isEmpty) {
                          return context.l10n.checkoutPhoneRequired;
                        }
                        final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
                        if (digits.length < 9 || phone.length > 30) {
                          return context.l10n.commonPhoneInvalid;
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.s24),
                    AppButton.primary(
                      label: context.l10n.serviceRequestSubmit,
                      loading: _submitting,
                      expand: true,
                      onPressed: _submit,
                    ),
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

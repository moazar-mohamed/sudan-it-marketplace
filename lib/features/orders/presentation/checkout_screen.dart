import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_state.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../location/domain/geo_location.dart';
import '../../location/presentation/location_strings.dart';
import '../../location/presentation/widgets/location_field.dart';
import '../../location/presentation/widgets/open_location_button.dart';
import '../../products/domain/entities/product.dart';
import '../domain/entities/checkout_order_draft.dart';
import '../domain/entities/order_entity.dart';
import 'manual_payment_screen.dart';
import 'widgets/price_summary_row.dart';
import '../../../core/localization/l10n_extension.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({
    super.key,
    required this.product,
    required this.quantity,
  });

  final Product product;
  final int quantity;

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();

  /// Optional exact delivery point picked on the map. The typed address and
  /// the map point are independent: either one, or both, satisfies checkout.
  GeoLocation? _deliveryLocation;
  bool _locationMissing = false;

  bool _includeInstallation = false;
  static const double _standardDeliveryFee = 15000.0;

  /// Delivery can only be chosen when the product allows it; otherwise the
  /// order is collected from the company's pickup location.
  late bool _useDelivery = widget.product.isDeliveryAvailable;

  /// Checkout is only reachable for a priced product: Buy Now is disabled while
  /// a product has no price, and a missing price is never treated as 0.
  double get _unitPrice => widget.product.price!;

  double get _deliveryFee => _useDelivery ? _standardDeliveryFee : 0.0;

  /// Installation is only offered when the product supports it AND the
  /// customer chose Delivery; picking "No Delivery" hides it entirely.
  bool get _installationEligible =>
      _useDelivery && widget.product.isInstallationAvailable;

  /// The company's pickup point. Pass a [display] context to show the
  /// fallback text in the active language; without it the stored (English)
  /// text is returned, which is what is saved on the order.
  String _pickupLocation([BuildContext? display]) {
    final companyId = widget.product.companyId;
    final company =
        companyId == null ? null : ref.read(resolvedCompanyProvider(companyId));
    final pickup = company?.pickupAddress?.trim() ?? '';
    if (pickup.isNotEmpty) {
      return pickup;
    }
    final address = company?.address?.trim() ?? '';
    if (address.isNotEmpty) {
      return address;
    }
    return display?.l10n.checkoutPickupFallback ??
        'Company pickup location (the company will confirm by phone)';
  }

  @override
  void initState() {
    super.initState();
    // Typing an address satisfies the "address or map" requirement.
    _addressController.addListener(() {
      if (_locationMissing && _addressController.text.trim().isNotEmpty) {
        setState(() => _locationMissing = false);
      }
    });
  }

  GeoLocation? _pickupCoordinates() {
    final companyId = widget.product.companyId;
    return companyId == null
        ? null
        : ref.read(resolvedCompanyProvider(companyId))?.coordinates;
  }

  @override
  void dispose() {
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String _formatPrice(double price) {
    final parts = price.toStringAsFixed(0).split('.');
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return parts[0].replaceAllMapped(regExp, (Match m) => '${m[1]},');
  }

  Future<void> _onConfirmOrder() async {
    final formValid = _formKey.currentState?.validate() ?? false;
    if (_useDelivery &&
        _addressController.text.trim().isEmpty &&
        _deliveryLocation == null) {
      setState(() => _locationMissing = true);
      return;
    }
    if (!formValid) {
      return;
    }

    final productSubtotal = _unitPrice * widget.quantity;
    final installationCharge = (_installationEligible && _includeInstallation)
        ? (widget.product.installationPrice ?? 0.0)
        : 0.0;
    final finalTotal = productSubtotal + installationCharge + _deliveryFee;

    final authState = ref.read(authControllerProvider);
    final customerId = switch (authState) {
      AuthAuthenticated(:final user) => user.id,
      _ => FirebaseAuth.instance.currentUser?.uid ?? 'guest_customer',
    };

    final draft = CheckoutOrderDraft(
      orderId: DateTime.now().microsecondsSinceEpoch.toRadixString(36),
      customerId: customerId,
      // Never a made-up company: a product with no company id cannot be
      // ordered (the security rules reject an empty companyId).
      companyId: widget.product.companyId ?? '',
      companyName: widget.product.companyName ?? '',
      productId: widget.product.id,
      productName: widget.product.name,
      quantity: widget.quantity,
      unitPrice: _unitPrice,
      productSubtotal: productSubtotal,
      installationSelected: _installationEligible && _includeInstallation,
      installationFee: installationCharge,
      deliveryFee: _deliveryFee,
      totalAmount: finalTotal,
      deliveryAddress: _useDelivery
          ? _addressController.text.trim()
          : 'Pickup: ${_pickupLocation()}',
      // Pickup uses the company's own location, so no delivery point is saved.
      deliveryLatitude: _useDelivery ? _deliveryLocation?.latitude : null,
      deliveryLongitude: _useDelivery ? _deliveryLocation?.longitude : null,
      contactPhone: _phoneController.text.trim(),
      deliveryMethod:
          _useDelivery ? DeliveryMethod.delivery : DeliveryMethod.pickup,
      customerName:
          ref.read(profileControllerProvider).asData?.value?.fullName ?? '',
    );

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ManualPaymentScreen(draft: draft),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final currency = widget.product.currency;

    final productCompanyId = widget.product.companyId;
    if (productCompanyId != null) {
      // Keep the pickup location up to date while checkout is open.
      ref.watch(resolvedCompanyProvider(productCompanyId));
    }

    final productSubtotal = _unitPrice * widget.quantity;
    final installationPrice = widget.product.installationPrice ?? 0.0;
    final installationCharge = (_installationEligible && _includeInstallation)
        ? installationPrice
        : 0.0;
    final finalTotal = productSubtotal + installationCharge + _deliveryFee;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.checkoutTitle),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. The item being bought.
                  AppCard(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppImageTile(imageUrl: widget.product.imageUrl),
                        const SizedBox(width: AppSpacing.s12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.product.name,
                                style: AppTextStyles.bodyStrong,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: AppSpacing.s4),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Flexible(
                                    child: Text(
                                      l10n.checkoutUnit(
                                        _formatPrice(_unitPrice),
                                        currency,
                                      ),
                                      style: AppTextStyles.caption.copyWith(
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    l10n.checkoutQty(widget.quantity),
                                    style: AppTextStyles.captionStrong,
                                  ),
                                ],
                              ),
                              Text(
                                l10n.checkoutSubtotal(
                                  _formatPrice(productSubtotal),
                                  currency,
                                ),
                                style: AppTextStyles.bodyStrong
                                    .copyWith(color: AppColors.textBrand),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s20),

                  // 2. Delivery and contact details.
                  Text(
                    widget.product.isDeliveryAvailable
                        ? l10n.checkoutDeliveryContact
                        : l10n.checkoutPickupContact,
                    style: AppTextStyles.h3,
                  ),
                  const SizedBox(height: AppSpacing.s8),
                  AppCard(
                    padding: const EdgeInsets.all(AppSpacing.s16),
                    child: Column(
                      children: [
                        // Delivery / pickup choice (only when delivery is
                        // offered).
                        if (widget.product.isDeliveryAvailable) ...[
                          SizedBox(
                            width: double.infinity,
                            child: SegmentedButton<bool>(
                              segments: [
                                ButtonSegment<bool>(
                                  value: true,
                                  icon: const Icon(Icons.local_shipping_outlined),
                                  label: Text(l10n.checkoutDelivery),
                                ),
                                ButtonSegment<bool>(
                                  value: false,
                                  icon: const Icon(Icons.storefront_outlined),
                                  label: Text(l10n.checkoutPickup),
                                ),
                              ],
                              selected: {_useDelivery},
                              onSelectionChanged: (selection) {
                                setState(() {
                                  _useDelivery = selection.first;
                                  if (!_useDelivery) {
                                    // No delivery: installation is not offered.
                                    _includeInstallation = false;
                                  }
                                });
                              },
                            ),
                          ),
                          const SizedBox(height: AppSpacing.s16),
                        ],
                        if (!_useDelivery) ...[
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const AppIconTile(
                                icon: Icons.storefront_outlined,
                                size: 40,
                              ),
                              const SizedBox(width: AppSpacing.s12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      l10n.checkoutPickupLocation,
                                      style: AppTextStyles.bodyStrong,
                                    ),
                                    Text(
                                      _pickupLocation(context),
                                      style: AppTextStyles.body.copyWith(
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                    if (_pickupCoordinates() != null) ...[
                                      const SizedBox(height: AppSpacing.s8),
                                      OpenLocationButton(
                                        label:
                                            LocationStrings.of(context).viewOnMap,
                                        viewerTitle: l10n.checkoutPickupLocation,
                                        coordinates: _pickupCoordinates(),
                                        text: _pickupLocation(context),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.s16),
                        ],
                        if (_useDelivery) ...[
                          LocationField(
                            textController: _addressController,
                            location: _deliveryLocation,
                            textHint: l10n.checkoutAddressHint,
                            errorText: _locationMissing
                                ? LocationStrings.of(context).locationRequired
                                : null,
                            onLocationChanged: (value) => setState(() {
                              _deliveryLocation = value;
                              _locationMissing = false;
                            }),
                          ),
                          const SizedBox(height: AppSpacing.s16),
                        ],
                        // One contact phone number.
                        AppTextField(
                          label: l10n.checkoutContactPhone,
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9+\s]'),
                            ),
                          ],
                          hint: '‎+249 9X XXX XXXX',
                          prefixIcon: Icons.phone_outlined,
                          helperText: l10n.checkoutContactPhoneHelper,
                          validator: (value) {
                            final phone = value?.trim() ?? '';
                            if (phone.isEmpty) {
                              return l10n.checkoutPhoneRequired;
                            }
                            final digitsOnly = phone.replaceAll(
                              RegExp(r'[^0-9]'),
                              '',
                            );
                            if (digitsOnly.length < 9) {
                              return l10n.commonPhoneInvalid;
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s20),

                  // 3. Installation option (only when delivery is selected and
                  // the product supports installation).
                  if (_installationEligible) ...[
                    Text(l10n.checkoutInstallationOption, style: AppTextStyles.h3),
                    const SizedBox(height: AppSpacing.s8),
                    AppCard(
                      padding: const EdgeInsets.all(AppSpacing.s16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.handyman_outlined,
                                color: AppColors.primary,
                                size: AppSize.iconMd,
                              ),
                              const SizedBox(width: AppSpacing.s8),
                              Expanded(
                                child: Text(
                                  l10n.checkoutInstallationTitle,
                                  style: AppTextStyles.bodyStrong,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.s4),
                          Text(
                            l10n.checkoutInstallationNote(
                              _formatPrice(installationPrice),
                              currency,
                            ),
                            style: AppTextStyles.caption
                                .copyWith(color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: AppSpacing.s12),
                          // Equal-height options, whatever their text wraps to.
                          IntrinsicHeight(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: AppOptionCard(
                                    title: l10n.checkoutProductOnly,
                                    subtitle: '0 $currency',
                                    selected: !_includeInstallation,
                                    onTap: () => setState(
                                      () => _includeInstallation = false,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.s12),
                                Expanded(
                                  child: AppOptionCard(
                                    title: l10n.checkoutProductInstallation,
                                    subtitle:
                                        '+${_formatPrice(installationPrice)} $currency',
                                    selected: _includeInstallation,
                                    onTap: () => setState(
                                      () => _includeInstallation = true,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.s20),
                  ],

                  // 4. Price summary.
                  Text(l10n.checkoutPriceSummary, style: AppTextStyles.h3),
                  const SizedBox(height: AppSpacing.s8),
                  AppCard(
                    padding: const EdgeInsets.all(AppSpacing.s16),
                    child: Column(
                      children: [
                        PriceSummaryRow(
                          label: l10n.checkoutProductSubtotal(widget.quantity),
                          value: '${_formatPrice(productSubtotal)} $currency',
                        ),
                        if (_installationEligible) ...[
                          const SizedBox(height: AppSpacing.s8),
                          PriceSummaryRow(
                            label: l10n.checkoutInstallationService,
                            value: _includeInstallation
                                ? '+${_formatPrice(installationPrice)} $currency'
                                : l10n.checkoutNotIncluded,
                          ),
                        ],
                        if (_useDelivery) ...[
                          const SizedBox(height: AppSpacing.s8),
                          PriceSummaryRow(
                            label: l10n.checkoutDeliveryFee,
                            value: '${_formatPrice(_deliveryFee)} $currency',
                          ),
                        ],
                        const SizedBox(height: AppSpacing.s12),
                        const Divider(height: 1),
                        const SizedBox(height: AppSpacing.s12),
                        PriceSummaryRow(
                          label: l10n.checkoutFinalTotal,
                          value: '${_formatPrice(finalTotal)} $currency',
                          total: true,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s24),

                  // 5. Confirm.
                  AppButton.primary(
                    label: l10n.checkoutConfirmOrder(
                      _formatPrice(finalTotal),
                      currency,
                    ),
                    expand: true,
                    onPressed: _onConfirmOrder,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

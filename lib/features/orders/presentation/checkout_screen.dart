import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
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
  String? _locationError;

  bool _includeInstallation = false;
  static const double _standardDeliveryFee = 15000.0;

  /// Delivery can only be chosen when the product allows it; otherwise the
  /// order is collected from the company's pickup location.
  late bool _useDelivery = widget.product.isDeliveryAvailable;

  double get _deliveryFee => _useDelivery ? _standardDeliveryFee : 0.0;

  /// Installation is only offered when the product supports it AND the
  /// customer chose Delivery; picking "No Delivery" hides it entirely.
  bool get _installationEligible =>
      _useDelivery && widget.product.isInstallationAvailable;

  String _pickupLocation() {
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
    return 'Company pickup location (the company will confirm by phone)';
  }

  @override
  void initState() {
    super.initState();
    // Typing an address satisfies the "address or map" requirement.
    _addressController.addListener(() {
      if (_locationError != null && _addressController.text.trim().isNotEmpty) {
        setState(() => _locationError = null);
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
      setState(() => _locationError = LocationStrings.of(context).locationRequired);
      return;
    }
    if (!formValid) {
      return;
    }

    final productSubtotal = widget.product.price * widget.quantity;
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
      companyId: widget.product.companyId ?? 'c1',
      companyName: widget.product.companyName ?? '',
      productId: widget.product.id,
      productName: widget.product.name,
      quantity: widget.quantity,
      unitPrice: widget.product.price,
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
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    final productCompanyId = widget.product.companyId;
    if (productCompanyId != null) {
      // Keep the pickup location up to date while checkout is open.
      ref.watch(resolvedCompanyProvider(productCompanyId));
    }

    final productSubtotal = widget.product.price * widget.quantity;
    final installationPrice = widget.product.installationPrice ?? 0.0;
    final installationCharge = (_installationEligible && _includeInstallation)
        ? installationPrice
        : 0.0;
    final finalTotal = productSubtotal + installationCharge + _deliveryFee;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Checkout'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Order Item Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: colorScheme.onSurface.withValues(alpha: 0.08),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppColors.secondary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppColors.secondary.withValues(alpha: 0.15),
                        ),
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.inventory_2_outlined,
                          color: AppColors.primary,
                          size: 28,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.product.name,
                            style: textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: colorScheme.onSurface,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Unit: ${_formatPrice(widget.product.price)} ${widget.product.currency}',
                                style: textTheme.bodySmall?.copyWith(
                                  color: colorScheme.onSurface
                                      .withValues(alpha: 0.6),
                                ),
                              ),
                              Text(
                                'Qty: ${widget.quantity}',
                                style: textTheme.bodySmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: colorScheme.onSurface,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Subtotal: ${_formatPrice(productSubtotal)} ${widget.product.currency}',
                            style: textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 2. Delivery & Contact Details
              Text(
                widget.product.isDeliveryAvailable
                    ? 'Delivery & Contact'
                    : 'Pickup & Contact',
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: colorScheme.onSurface.withValues(alpha: 0.08),
                  ),
                ),
                child: Column(
                  children: [
                    // Delivery / Pickup choice (only when delivery is offered)
                    if (widget.product.isDeliveryAvailable) ...[
                      SizedBox(
                        width: double.infinity,
                        child: SegmentedButton<bool>(
                          segments: const [
                            ButtonSegment<bool>(
                              value: true,
                              icon: Icon(Icons.local_shipping_outlined),
                              label: Text('Delivery'),
                            ),
                            ButtonSegment<bool>(
                              value: false,
                              icon: Icon(Icons.storefront_outlined),
                              label: Text('Pickup'),
                            ),
                          ],
                          selected: {_useDelivery},
                          onSelectionChanged: (selection) {
                            setState(() {
                              _useDelivery = selection.first;
                              if (!_useDelivery) {
                                // No Delivery: installation is not offered.
                                _includeInstallation = false;
                              }
                            });
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (!_useDelivery) ...[
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.storefront_outlined,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Pickup Location',
                                  style: textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _pickupLocation(),
                                  style: textTheme.bodySmall?.copyWith(
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.75),
                                  ),
                                ),
                                if (_pickupCoordinates() != null) ...[
                                  const SizedBox(height: 8),
                                  OpenLocationButton(
                                    label: LocationStrings.of(context).viewOnMap,
                                    viewerTitle: 'Pickup Location',
                                    coordinates: _pickupCoordinates(),
                                    text: _pickupLocation(),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],
                    // Delivery Address Field
                    if (_useDelivery) ...[
                    LocationField(
                      textController: _addressController,
                      location: _deliveryLocation,
                      textHint: 'Street name, building/house, neighborhood, city',
                      errorText: _locationError,
                      onLocationChanged: (value) => setState(() {
                        _deliveryLocation = value;
                        _locationError = null;
                      }),
                    ),
                    const SizedBox(height: 16),
                    ],
                    // ONE contact phone number field only
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'[0-9+\s]'),
                        ),
                      ],
                      decoration: const InputDecoration(
                        labelText: 'Contact Phone Number',
                        hintText: '+249 9X XXX XXXX',
                        prefixIcon: Icon(Icons.phone_outlined),
                        helperText:
                            'The company will call this number to coordinate delivery',
                      ),
                      validator: (value) {
                        final phone = value?.trim() ?? '';
                        if (phone.isEmpty) {
                          return 'Please enter a contact phone number';
                        }
                        final digitsOnly = phone.replaceAll(
                          RegExp(r'[^0-9]'),
                          '',
                        );
                        if (digitsOnly.length < 9) {
                          return 'Enter a valid phone number';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // 3. Installation Option (only when Delivery is selected and
              // the product supports installation)
              if (_installationEligible) ...[
                Text(
                  'Installation Option',
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colorScheme.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: colorScheme.onSurface.withValues(alpha: 0.08),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.handyman_outlined,
                            color: AppColors.primary,
                            size: 22,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'On-site Professional Installation',
                              style: textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Certified technician setup available for ${_formatPrice(installationPrice)} ${widget.product.currency}.',
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurface.withValues(alpha: 0.7),
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Yes / No Selection
                      Row(
                        children: [
                          // No Option
                          Expanded(
                            child: InkWell(
                              onTap: () {
                                setState(() => _includeInstallation = false);
                              },
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                  horizontal: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: !_includeInstallation
                                      ? AppColors.primary.withValues(alpha: 0.08)
                                      : colorScheme.surface,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: !_includeInstallation
                                        ? AppColors.primary
                                        : colorScheme.onSurface
                                            .withValues(alpha: 0.15),
                                    width: !_includeInstallation ? 1.5 : 1,
                                  ),
                                ),
                                child: Column(
                                  children: [
                                    Icon(
                                      !_includeInstallation
                                          ? Icons.radio_button_checked
                                          : Icons.radio_button_unchecked,
                                      color: !_includeInstallation
                                          ? AppColors.primary
                                          : colorScheme.onSurface
                                              .withValues(alpha: 0.4),
                                      size: 20,
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      'Product Only',
                                      textAlign: TextAlign.center,
                                      style: textTheme.bodySmall?.copyWith(
                                        fontWeight: !_includeInstallation
                                            ? FontWeight.w700
                                            : FontWeight.w500,
                                        color: !_includeInstallation
                                            ? AppColors.primary
                                            : colorScheme.onSurface,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'SDG 0',
                                      style: textTheme.labelSmall?.copyWith(
                                        color: colorScheme.onSurface
                                            .withValues(alpha: 0.5),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // Yes Option
                          Expanded(
                            child: InkWell(
                              onTap: () {
                                setState(() => _includeInstallation = true);
                              },
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                  horizontal: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: _includeInstallation
                                      ? AppColors.primary.withValues(alpha: 0.08)
                                      : colorScheme.surface,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _includeInstallation
                                        ? AppColors.primary
                                        : colorScheme.onSurface
                                            .withValues(alpha: 0.15),
                                    width: _includeInstallation ? 1.5 : 1,
                                  ),
                                ),
                                child: Column(
                                  children: [
                                    Icon(
                                      _includeInstallation
                                          ? Icons.radio_button_checked
                                          : Icons.radio_button_unchecked,
                                      color: _includeInstallation
                                          ? AppColors.primary
                                          : colorScheme.onSurface
                                              .withValues(alpha: 0.4),
                                      size: 20,
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      'Product + Installation',
                                      textAlign: TextAlign.center,
                                      style: textTheme.bodySmall?.copyWith(
                                        fontWeight: _includeInstallation
                                            ? FontWeight.w700
                                            : FontWeight.w500,
                                        color: _includeInstallation
                                            ? AppColors.primary
                                            : colorScheme.onSurface,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '+${_formatPrice(installationPrice)} SDG',
                                      style: textTheme.labelSmall?.copyWith(
                                        fontWeight: FontWeight.w600,
                                        color: _includeInstallation
                                            ? AppColors.primary
                                            : colorScheme.onSurface
                                                .withValues(alpha: 0.6),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // 4. Order Price Summary
              Text(
                'Price Summary',
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: colorScheme.onSurface.withValues(alpha: 0.08),
                  ),
                ),
                child: Column(
                  children: [
                    PriceSummaryRow(
                      label: 'Product Subtotal (${widget.quantity} items)',
                      value:
                          '${_formatPrice(productSubtotal)} ${widget.product.currency}',
                      labelStyle: textTheme.bodyMedium,
                      valueStyle: textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (_installationEligible) ...[
                      const SizedBox(height: 10),
                      PriceSummaryRow(
                        label: 'Installation Service',
                        value: _includeInstallation
                            ? '+${_formatPrice(installationPrice)} ${widget.product.currency}'
                            : 'Not included',
                        labelStyle: textTheme.bodyMedium,
                        valueStyle: textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: _includeInstallation
                              ? AppColors.primary
                              : colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                      ),
                    ],
                    if (_useDelivery) ...[
                      const SizedBox(height: 10),
                      PriceSummaryRow(
                        label: 'Delivery Fee',
                        value:
                            '${_formatPrice(_deliveryFee)} ${widget.product.currency}',
                        labelStyle: textTheme.bodyMedium,
                        valueStyle: textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    const Divider(),
                    const SizedBox(height: 10),
                    PriceSummaryRow(
                      label: 'Final Total',
                      value:
                          '${_formatPrice(finalTotal)} ${widget.product.currency}',
                      labelStyle: textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                      valueStyle: textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 5. Confirm Order Button
              ElevatedButton(
                onPressed: _onConfirmOrder,
                child: Text(
                  'Confirm Order • ${_formatPrice(finalTotal)} ${widget.product.currency}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

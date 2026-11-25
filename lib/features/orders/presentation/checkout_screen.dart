import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/text_clip.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_state.dart';
import '../../cities/presentation/city_providers.dart';
import '../../cities/presentation/city_tags.dart';
import '../../companies/domain/entities/pickup_point.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../location/domain/geo_location.dart';
import '../../location/presentation/location_strings.dart';
import '../../location/presentation/widgets/location_field.dart';
import '../../location/presentation/widgets/open_location_button.dart';
import '../../products/domain/entities/product.dart';
import '../domain/entities/checkout_order_draft.dart';
import '../domain/entities/order_entity.dart';
import '../domain/order_limits.dart';
import '../../customer_dashboard/presentation/site/site_cards.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../customer_dashboard/presentation/site/site_orders.dart';
import 'manual_payment_screen.dart';
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
  final _phoneController = PhoneController();

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
  /// a product has no price, and a missing price is never treated as 0. While
  /// an offer runs the customer pays the offer price.
  double get _unitPrice => widget.product.salePrice!;

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
    final company = companyId == null
        ? null
        : ref.read(resolvedCompanyProvider(companyId));
    final point = _selectedPickupPoint();
    if (point != null && point.label.isNotEmpty) {
      return point.label;
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

  /// The places the company hands orders over at (empty: its own location).
  List<PickupPoint> _pickupPoints() {
    final companyId = widget.product.companyId;
    return companyId == null
        ? const []
        : ref.read(resolvedCompanyProvider(companyId))?.effectivePickupPoints ??
              const [];
  }

  /// Which of [_pickupPoints] the customer picked. Kept in range, because the
  /// company may edit its points while checkout is open.
  int _pickupIndex = 0;

  int get _pickupIndexInRange {
    final count = _pickupPoints().length;
    return count == 0 ? 0 : _pickupIndex.clamp(0, count - 1);
  }

  PickupPoint? _selectedPickupPoint() {
    final points = _pickupPoints();
    return points.isEmpty ? null : points[_pickupIndexInRange];
  }

  GeoLocation? _pickupCoordinates() {
    final companyId = widget.product.companyId;
    final company = companyId == null
        ? null
        : ref.read(resolvedCompanyProvider(companyId));
    final point = _selectedPickupPoint();
    if (point == null) {
      return company?.coordinates;
    }
    // A company that only ever wrote one address has no point of its own to
    // show; its map point (if any) is the best the customer can be given.
    return point.coordinates ??
        (point.name.isEmpty ? company?.coordinates : null);
  }

  @override
  void dispose() {
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
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
    // Stop here, with a clear reason, instead of letting the server refuse it.
    // A pickup is collected in person, so it is not tied to a city.
    if (_useDelivery &&
        !ref.read(
          companyServesMyCityProvider(widget.product.companyId ?? ''),
        )) {
      showAppSnackBar(
        context,
        context.l10n.cityDeliveryNeedsCity,
        tone: AppTone.error,
      );
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
      // Both within what the rules accept for an order's address. The typed
      // one already is (the field stops there); a company's own pickup
      // address has no such limit, so it is cut here.
      deliveryAddress: clipToLength(
        _useDelivery
            ? _addressController.text.trim()
            : 'Pickup: ${_pickupLocation()}',
        OrderLimits.deliveryAddress,
      ),
      // Pickup uses the company's own location, so no delivery point is saved.
      deliveryLatitude: _useDelivery ? _deliveryLocation?.latitude : null,
      deliveryLongitude: _useDelivery ? _deliveryLocation?.longitude : null,
      contactPhone: _phoneController.value,
      deliveryMethod: _useDelivery
          ? DeliveryMethod.delivery
          : DeliveryMethod.pickup,
      // The city the order is delivered to; a pickup has none.
      deliveryCityId: _useDelivery ? ref.read(deliveryCityIdProvider) : null,
      // A profile name has no length limit of its own; the order's copy does.
      customerName: clipToLength(
        ref.read(profileControllerProvider).asData?.value?.fullName ?? '',
        OrderLimits.customerName,
      ),
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
    final colors = context.colors;
    final currency = widget.product.currency;
    String money(double value) => sitePrice(context, value, currency);

    final productCompanyId = widget.product.companyId;
    final company = productCompanyId == null
        ? null
        // Keep the pickup location up to date while checkout is open.
        : ref.watch(resolvedCompanyProvider(productCompanyId));

    final productSubtotal = _unitPrice * widget.quantity;
    final installationPrice = widget.product.installationPrice ?? 0.0;
    final installationCharge = (_installationEligible && _includeInstallation)
        ? installationPrice
        : 0.0;
    final finalTotal = productSubtotal + installationCharge + _deliveryFee;
    final image = (widget.product.imageUrl ?? '').trim();
    final meta = AppTextStyles.caption.copyWith(
      fontSize: 13,
      color: colors.textSecondary,
    );

    final blocks = <Widget>[
      SitePageTitle(l10n.checkoutTitle),

      // 1. The item being bought (`.line-item`).
      SiteTile(
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Container(
                width: 72,
                height: 72,
                color: colors.bgSubtle,
                child: image.isEmpty
                    ? Icon(
                        Icons.inventory_2_outlined,
                        size: 32,
                        color: colors.textSecondary,
                      )
                    : AppNetworkImage(
                        url: image,
                        fit: BoxFit.contain,
                        fallback: const SizedBox.shrink(),
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
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    l10n.siteCheckoutUnitLine(
                      money(_unitPrice),
                      widget.quantity,
                    ),
                    style: meta,
                  ),
                  Text(
                    l10n.siteCheckoutSubtotal(money(productSubtotal)),
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontWeight: FontWeight.w800,
                      color: colors.price,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),

      // 2. Delivery (or pickup) and contact.
      SiteTile(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SiteTileTitle(
              widget.product.isDeliveryAvailable
                  ? l10n.checkoutDeliveryContact
                  : l10n.checkoutPickupContact,
            ),
            const SizedBox(height: 14),
            if (widget.product.isDeliveryAvailable) ...[
              SiteSegment<bool>(
                key: const ValueKey('checkout-method'),
                value: _useDelivery,
                options: [
                  (true, l10n.checkoutDelivery, null),
                  (false, l10n.checkoutPickup, null),
                ],
                onChanged: (delivery) => setState(() {
                  _useDelivery = delivery;
                  // No delivery: installation is not offered.
                  if (!delivery) _includeInstallation = false;
                }),
              ),
              const SizedBox(height: 16),
            ],
            if (!_useDelivery) ...[
              if (_pickupPoints().length > 1) ...[
                Text(
                  l10n.checkoutChoosePickupPoint,
                  style: AppTextStyles.bodyStrong,
                ),
                const SizedBox(height: 8),
                for (var i = 0; i < _pickupPoints().length; i++)
                  _PickupPointTile(
                    key: ValueKey('checkout-pickup-point-$i'),
                    point: _pickupPoints()[i],
                    selected: i == _pickupIndexInRange,
                    onTap: () => setState(() => _pickupIndex = i),
                  ),
                const SizedBox(height: 12),
              ],
              SiteNote(
                icon: Icons.location_on_outlined,
                title: l10n.checkoutPickupLocation,
                message: _pickupLocation(context),
              ),
              if (_pickupCoordinates() != null) ...[
                const SizedBox(height: 8),
                OpenLocationButton(
                  label: LocationStrings.of(context).viewOnMap,
                  viewerTitle: l10n.checkoutPickupLocation,
                  coordinates: _pickupCoordinates(),
                  text: _pickupLocation(context),
                ),
              ],
              const SizedBox(height: 16),
            ],
            if (_useDelivery) ...[
              DeliveryCityRow(companyId: widget.product.companyId ?? ''),
              const SizedBox(height: 16),
              LocationField(
                textController: _addressController,
                location: _deliveryLocation,
                textHint: l10n.checkoutAddressHint,
                maxTextLength: OrderLimits.deliveryAddress,
                errorText: _locationMissing
                    ? LocationStrings.of(context).locationRequired
                    : null,
                onLocationChanged: (value) => setState(() {
                  _deliveryLocation = value;
                  _locationMissing = false;
                }),
              ),
              const SizedBox(height: 16),
            ],
            // One contact phone number, with its country code.
            PhoneField(
              label: l10n.checkoutContactPhone,
              controller: _phoneController,
              helperText: l10n.checkoutContactPhoneHelper,
              requiredMessage: l10n.checkoutPhoneRequired,
            ),
          ],
        ),
      ),

      // 3. Installation (delivery only, when the product offers it).
      if (_installationEligible)
        SiteTile(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SiteTileTitle(l10n.checkoutInstallationOption),
              const SizedBox(height: 6),
              SiteProse(l10n.siteCheckoutInstallNote(money(installationPrice))),
              const SizedBox(height: 12),
              SiteSegment<bool>(
                key: const ValueKey('checkout-installation'),
                value: _includeInstallation,
                options: [
                  (false, l10n.checkoutProductOnly, money(0)),
                  (
                    true,
                    l10n.checkoutProductInstallation,
                    '+${money(installationPrice)}',
                  ),
                ],
                onChanged: (v) => setState(() => _includeInstallation = v),
              ),
            ],
          ),
        ),

      // 4. The price summary (`.specs` with `.total-row`).
      SiteTile(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SiteTileTitle(l10n.checkoutPriceSummary),
            const SizedBox(height: 12),
            SiteSummary(
              rows: [
                (
                  l10n.checkoutProductSubtotal(widget.quantity),
                  money(productSubtotal),
                ),
                if (_installationEligible)
                  (
                    l10n.checkoutInstallationService,
                    _includeInstallation
                        ? '+${money(installationPrice)}'
                        : l10n.checkoutNotIncluded,
                  ),
                if (_useDelivery)
                  (l10n.checkoutDeliveryFee, money(_deliveryFee)),
              ],
              total: (l10n.checkoutFinalTotal, money(finalTotal)),
            ),
          ],
        ),
      ),

      // What happens next: the product is reserved only once the company
      // confirms the payment.
      SiteNote(
        key: const ValueKey('checkout-reservation-note'),
        icon: Icons.inventory_2_outlined,
        title: '',
        message: l10n.checkoutReservationNote,
      ),

      // 5. Confirm.
      AppButton.primary(
        label: l10n.siteCheckoutConfirm(money(finalTotal)),
        expand: true,
        onPressed: _onConfirmOrder,
      ),
    ];

    return Scaffold(
      appBar: AppBar(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // «الطلب من …» (`.checkout-company`).
                  if (company != null)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SiteCompanyLogo(company: company, size: 36),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            l10n.siteCheckoutFrom(company.name),
                            style: meta,
                          ),
                        ),
                      ],
                    ),
                  for (final block in blocks) ...[
                    const SizedBox(height: 16),
                    block,
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One of the company's pickup points, as a radio row.
class _PickupPointTile extends StatelessWidget {
  const _PickupPointTile({
    super.key,
    required this.point,
    required this.selected,
    required this.onTap,
  });

  final PickupPoint point;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: AppRadius.mdAll,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
        child: Row(
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: context.colors.brandPrimary,
            ),
            const SizedBox(width: AppSpacing.s12),
            Expanded(
              child: Text(
                point.name.isEmpty ? point.address : point.name,
                style: AppTextStyles.body,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

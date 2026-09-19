import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../companies/presentation/companies_providers.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../location/presentation/widgets/open_location_button.dart';
import '../../domain/entities/order_entity.dart';

/// What to print for an order's delivery address: the written address, or a
/// "pinned on map" note for map-only orders (no typed address).
String orderDeliveryLabel(BuildContext context, OrderEntity order) {
  return order.deliveryText ??
      (order.hasDeliveryCoordinates
          ? LocationStrings.of(context).pinnedOnMap
          : '—');
}

/// Opens the location that was captured WITH THE ORDER at checkout.
///
///  * Exact map point saved -> opens exactly that point.
///  * Only a written address -> a clearly-labelled maps search (never
///    presented as an exact GPS point).
///  * Pickup orders have no customer location -> nothing is shown.
///
/// This is deliberately not connected to the company profile: an order screen
/// only ever shows the order/customer location.
class OrderLocationButton extends StatelessWidget {
  const OrderLocationButton({
    super.key,
    required this.order,
    required this.label,
  });

  final OrderEntity order;

  /// "Open Order Location" (technician) or "Open Delivery Location".
  final String label;

  @override
  Widget build(BuildContext context) {
    if (order.deliveryMethod != DeliveryMethod.delivery) {
      return const SizedBox.shrink();
    }
    return OpenLocationButton(
      label: label,
      viewerTitle: label,
      coordinates: order.deliveryCoordinates,
      text: order.deliveryText,
      allowTextSearch: true,
    );
  }
}

/// For PICKUP orders only: the collecting point is the company's own location.
/// Used by the customer and by the company that owns the order. It is never
/// used on a technician's installation order.
class PickupCompanyLocationButton extends ConsumerWidget {
  const PickupCompanyLocationButton({super.key, required this.order});

  final OrderEntity order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (order.deliveryMethod != DeliveryMethod.pickup) {
      return const SizedBox.shrink();
    }
    final company = ref.watch(resolvedCompanyProvider(order.companyId));
    final coordinates = company?.coordinates;
    if (coordinates == null) {
      return const SizedBox.shrink();
    }
    final label = LocationStrings.of(context).openCompanyLocation;
    return OpenLocationButton(
      label: label,
      viewerTitle: label,
      coordinates: coordinates,
      text: company?.locationText,
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../location/data/location_service.dart';
import '../../location/domain/geo_location.dart';
import '../../location/presentation/location_strings.dart';
import '../../orders/domain/entities/order_entity.dart';

/// The technician's own position, asked for once and kept. Null when the
/// phone's location is off or refused: distances are then simply not shown.
final technicianPositionProvider = FutureProvider<GeoLocation?>((ref) async {
  final result = await ref.read(locationServiceProvider).currentLocation();
  return result.location;
});

/// A job that still needs the technician: not completed and not cancelled.
bool isOpenJob(OrderEntity job) =>
    job.orderStatus != OrderStatus.completed && !job.isCancelled;

/// Distance in km from [from] to the job's saved delivery point, or null when
/// either is unknown (a pickup order, or a written address only).
double? jobDistanceKm(OrderEntity job, GeoLocation? from) {
  final to = job.deliveryCoordinates;
  if (from == null || to == null) return null;
  final metres = Geolocator.distanceBetween(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );
  return metres / 1000;
}

String formatKm(double km) {
  if (km < 10) return km.toStringAsFixed(1);
  return km.round().toString();
}

/// The job to do next: among open jobs, the ones the company has confirmed
/// payment for come first; then the nearest when the distance is known, else
/// the oldest.
OrderEntity? nextJob(List<OrderEntity> jobs, GeoLocation? from) {
  final open = jobs.where(isOpenJob).toList();
  if (open.isEmpty) return null;
  open.sort((a, b) {
    final aPaid = a.paymentStatus == PaymentStatus.confirmed ? 0 : 1;
    final bPaid = b.paymentStatus == PaymentStatus.confirmed ? 0 : 1;
    if (aPaid != bPaid) return aPaid.compareTo(bPaid);
    final aKm = jobDistanceKm(a, from);
    final bKm = jobDistanceKm(b, from);
    if (aKm != null && bKm != null && aKm != bKm) return aKm.compareTo(bKm);
    return a.createdAt.compareTo(b.createdAt);
  });
  return open.first;
}

/// What the technician earned from installation fees of jobs finished in the
/// month of [now].
double monthInstallationFees(List<OrderEntity> jobs, DateTime now) {
  var total = 0.0;
  for (final job in jobs) {
    if (job.orderStatus != OrderStatus.completed) continue;
    final at = (job.updatedAt ?? job.createdAt).toLocal();
    if (at.year == now.year && at.month == now.month) {
      total += job.installationFee;
    }
  }
  return total;
}

/// Calls [phone] with the phone's dialler.
Future<void> callCustomer(BuildContext context, String phone) async {
  final number = phone.trim();
  if (number.isEmpty) return;
  var opened = false;
  try {
    opened = await launchUrl(Uri(scheme: 'tel', path: number));
  } catch (_) {
    opened = false;
  }
  if (!opened && context.mounted) {
    showAppSnackBar(context, context.l10n.errorGeneric, tone: AppTone.error);
  }
}

/// Opens the job's delivery point (or a search for its written address) in
/// the phone's maps app. Returns false when the job has neither.
Future<bool> openJobDirections(WidgetRef ref, OrderEntity job) {
  const launcher = ExternalMapLauncher();
  final point = job.deliveryCoordinates;
  if (point != null) {
    return launcher.open(ExternalMapLauncher.coordinatesUri(point));
  }
  final text = job.deliveryText;
  if (text != null) {
    return launcher.open(ExternalMapLauncher.searchUri(text));
  }
  return Future.value(false);
}

/// True when [openJobDirections] has somewhere to go.
bool jobHasDirections(OrderEntity job) =>
    job.deliveryMethod == DeliveryMethod.delivery &&
    (job.hasDeliveryCoordinates || job.deliveryText != null);

/// Shown when maps could not be opened.
void showMapsFailed(BuildContext context) {
  showAppSnackBar(
    context,
    LocationStrings.of(context).couldNotOpenMaps,
    tone: AppTone.error,
  );
}

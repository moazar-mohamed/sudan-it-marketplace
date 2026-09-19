import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_colors.dart';
import '../data/location_service.dart';
import '../data/map_config.dart';
import '../domain/geo_location.dart';
import 'location_strings.dart';
import 'widgets/map_widgets.dart';

/// Read-only map showing one saved point. Nothing here can change the
/// coordinates: it is used for order, delivery and company locations.
class LocationViewerScreen extends ConsumerWidget {
  const LocationViewerScreen({
    super.key,
    required this.title,
    required this.location,
    this.addressText,
  });

  final String title;
  final GeoLocation location;
  final String? addressText;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = LocationStrings.of(context);
    final theme = Theme.of(context);
    final text = addressText?.trim() ?? '';

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Column(
        children: [
          Expanded(
            child: FlutterMap(
              options: MapOptions(
                initialCenter: LatLng(location.latitude, location.longitude),
                initialZoom: MapConfig.selectedZoom,
              ),
              children: [
                const MapTileLayer(),
                LocationMarkerLayer(location: location),
                const MapAttribution(),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (text.isNotEmpty) ...[
                    Text(
                      text,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                  ],
                  CoordinatesText(location: location),
                  const SizedBox(height: 10),
                  ElevatedButton.icon(
                    onPressed: () async {
                      final opened = await ref
                          .read(externalMapLauncherProvider)
                          .open(ExternalMapLauncher.coordinatesUri(location));
                      if (!opened && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(strings.couldNotOpenMaps)),
                        );
                      }
                    },
                    icon: const Icon(
                      Icons.map_outlined,
                      color: AppColors.onPrimary,
                    ),
                    label: Text(strings.openInMapsApp),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

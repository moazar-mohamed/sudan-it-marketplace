import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/widgets/app_widgets.dart';
import '../data/location_service.dart';
import '../data/map_config.dart';
import '../domain/geo_location.dart';
import 'location_strings.dart';
import 'widgets/map_widgets.dart';

/// Interactive map where the user taps to choose an exact point, can move the
/// point by tapping again, and confirms it. Returns the chosen [GeoLocation],
/// or null when the user backs out.
class MapPickerScreen extends ConsumerStatefulWidget {
  const MapPickerScreen({super.key, this.initialLocation});

  final GeoLocation? initialLocation;

  static Future<GeoLocation?> open(
    BuildContext context, {
    GeoLocation? initialLocation,
  }) {
    return Navigator.of(context).push<GeoLocation>(
      MaterialPageRoute<GeoLocation>(
        builder: (_) => MapPickerScreen(initialLocation: initialLocation),
      ),
    );
  }

  @override
  ConsumerState<MapPickerScreen> createState() => _MapPickerScreenState();
}

class _MapPickerScreenState extends ConsumerState<MapPickerScreen> {
  final _mapController = MapController();
  GeoLocation? _selected;
  bool _locating = false;

  @override
  void initState() {
    super.initState();
    _selected = widget.initialLocation;
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _select(GeoLocation location, {bool moveCamera = false}) {
    setState(() => _selected = location);
    if (moveCamera) {
      _mapController.move(
        LatLng(location.latitude, location.longitude),
        MapConfig.selectedZoom,
      );
    }
  }

  Future<void> _useCurrentLocation() async {
    if (_locating) {
      return;
    }
    setState(() => _locating = true);
    final result = await ref.read(locationServiceProvider).currentLocation();
    if (!mounted) {
      return;
    }
    setState(() => _locating = false);
    final found = result.location;
    if (found != null) {
      _select(found, moveCamera: true);
      return;
    }
    // Denied or unavailable: tell the user, keep the map fully usable.
    final strings = LocationStrings.of(context);
    final message = switch (result.failure) {
      CurrentLocationFailure.serviceDisabled => strings.locationServiceOff,
      CurrentLocationFailure.denied => strings.permissionDenied,
      CurrentLocationFailure.deniedForever => strings.permissionDeniedForever,
      _ => strings.currentLocationUnavailable,
    };
    showAppSnackBar(context, message);
  }

  @override
  Widget build(BuildContext context) {
    final strings = LocationStrings.of(context);
    final theme = Theme.of(context);
    final selected = _selected;
    final center = selected ?? MapConfig.defaultCenter;

    return Scaffold(
      appBar: AppBar(title: Text(strings.location)),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: LatLng(center.latitude, center.longitude),
                    initialZoom: selected == null
                        ? MapConfig.defaultZoom
                        : MapConfig.selectedZoom,
                    onTap: (_, point) =>
                        _select(GeoLocation(point.latitude, point.longitude)),
                  ),
                  children: [
                    const MapTileLayer(),
                    if (selected != null)
                      LocationMarkerLayer(location: selected),
                    const MapAttribution(),
                  ],
                ),
                PositionedDirectional(
                  top: 12,
                  start: 12,
                  end: 12,
                  child: Material(
                    elevation: 2,
                    borderRadius: BorderRadius.circular(10),
                    color: theme.colorScheme.surface,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      child: Text(
                        strings.tapToSelect,
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  ),
                ),
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
                  if (selected != null) ...[
                    CoordinatesText(location: selected),
                    const SizedBox(height: 10),
                  ],
                  AppButton.outlined(
                    expand: true,
                    icon: Icons.my_location,
                    loading: _locating,
                    label: strings.useMyCurrentLocation,
                    onPressed: _useCurrentLocation,
                  ),
                  const SizedBox(height: 8),
                  AppButton.primary(
                    expand: true,
                    icon: Icons.check,
                    label: strings.confirmLocation,
                    onPressed: selected == null
                        ? null
                        : () => Navigator.of(context).pop(selected),
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

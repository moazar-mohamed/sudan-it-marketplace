import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../data/map_config.dart';
import '../../domain/geo_location.dart';
import '../location_strings.dart';

class MapTileLayer extends StatelessWidget {
  const MapTileLayer({super.key});

  @override
  Widget build(BuildContext context) {
    return TileLayer(
      urlTemplate: MapConfig.tileUrlTemplate,
      userAgentPackageName: MapConfig.userAgentPackageName,
    );
  }
}

class MapAttribution extends StatelessWidget {
  const MapAttribution({super.key});

  @override
  Widget build(BuildContext context) {
    return const SimpleAttributionWidget(source: Text(MapConfig.attribution));
  }
}

/// The selected-point marker; its tip sits exactly on the coordinates.
class LocationMarkerLayer extends StatelessWidget {
  const LocationMarkerLayer({super.key, required this.location});

  final GeoLocation location;

  @override
  Widget build(BuildContext context) {
    return MarkerLayer(
      markers: [
        Marker(
          point: LatLng(location.latitude, location.longitude),
          width: 48,
          height: 48,
          alignment: Alignment.topCenter,
          child: Icon(
            Icons.location_on,
            size: 48,
            color: Theme.of(context).colorScheme.error,
          ),
        ),
      ],
    );
  }
}

/// "Lat: xx.xxxxxx  Lng: xx.xxxxxx". Numbers always read left-to-right, even
/// inside an Arabic (RTL) screen.
class CoordinatesText extends StatelessWidget {
  const CoordinatesText({super.key, required this.location, this.style});

  final GeoLocation location;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final strings = LocationStrings.of(context);
    final base = style ?? Theme.of(context).textTheme.bodyMedium;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _line(strings.latitudeShort, location.latitudeText, base),
        _line(strings.longitudeShort, location.longitudeText, base),
      ],
    );
  }

  Widget _line(String label, String value, TextStyle? style) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$label: ', style: style),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Text(
            value,
            style: style?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

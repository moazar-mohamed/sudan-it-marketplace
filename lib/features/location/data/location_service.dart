import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../domain/geo_location.dart';

enum CurrentLocationFailure {
  serviceDisabled,
  denied,
  deniedForever,
  unavailable,
}

/// Result of asking the device for its position. Failing is normal (the user
/// may deny permission) and must never break the calling form.
class CurrentLocationResult {
  const CurrentLocationResult.found(GeoLocation this.location) : failure = null;
  const CurrentLocationResult.failed(CurrentLocationFailure this.failure)
    : location = null;

  final GeoLocation? location;
  final CurrentLocationFailure? failure;
}

/// Device GPS access. Permission is requested only when the user taps
/// "Use My Current Location", never just to enter an address.
class LocationService {
  const LocationService();

  Future<CurrentLocationResult> currentLocation() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return const CurrentLocationResult.failed(
          CurrentLocationFailure.serviceDisabled,
        );
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        return const CurrentLocationResult.failed(
          CurrentLocationFailure.deniedForever,
        );
      }
      if (permission == LocationPermission.denied) {
        return const CurrentLocationResult.failed(
          CurrentLocationFailure.denied,
        );
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      final location = GeoLocation.tryCreate(
        position.latitude,
        position.longitude,
      );
      return location == null
          ? const CurrentLocationResult.failed(
              CurrentLocationFailure.unavailable,
            )
          : CurrentLocationResult.found(location);
    } catch (_) {
      return const CurrentLocationResult.failed(
        CurrentLocationFailure.unavailable,
      );
    }
  }
}

final locationServiceProvider = Provider<LocationService>(
  (ref) => const LocationService(),
);

/// Opens the phone's maps app (or the browser) outside this app.
class ExternalMapLauncher {
  const ExternalMapLauncher();

  static Uri coordinatesUri(GeoLocation location) => Uri.https(
    'www.google.com',
    '/maps/search/',
    {'api': '1', 'query': '${location.latitudeText},${location.longitudeText}'},
  );

  /// A text search. This is only an approximation of where the address is,
  /// never an exact GPS point.
  static Uri searchUri(String text) => Uri.https(
    'www.google.com',
    '/maps/search/',
    {'api': '1', 'query': text.trim()},
  );

  Future<bool> open(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }
}

final externalMapLauncherProvider = Provider<ExternalMapLauncher>(
  (ref) => const ExternalMapLauncher(),
);

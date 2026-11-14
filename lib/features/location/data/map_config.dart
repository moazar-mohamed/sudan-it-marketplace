import '../domain/geo_location.dart';

/// Map configuration. The default provider is OpenStreetMap raster tiles,
/// which need no API key, account or billing.
///
/// The public OpenStreetMap tile server is meant for light use. If the app
/// grows, point [tileUrlTemplate] at a hosted provider (for example MapTiler
/// or Stadia Maps) and append its PUBLIC client key to the template. Never put
/// a private/secret key in the app.
class MapConfig {
  MapConfig._();

  static const tileUrlTemplate =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  /// Identifies this app to the tile server (required by the OSM tile policy).
  static const userAgentPackageName = 'com.example.sudan_it_marketplace';

  static const attribution = '© OpenStreetMap contributors';

  /// Where the picker opens when nothing is selected yet: Khartoum.
  static const defaultCenter = GeoLocation(15.5007, 32.5599);
  static const defaultZoom = 12.0;
  static const selectedZoom = 16.0;
}

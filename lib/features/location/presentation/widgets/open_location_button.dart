import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/app_widgets.dart';
import '../../data/location_service.dart';
import '../../domain/geo_location.dart';
import '../location_strings.dart';
import '../location_viewer_screen.dart';

/// Opens a saved location. Read-only: it never edits anything.
///
///  * With [coordinates] it opens the exact saved point on a map.
///  * With only [text] and [allowTextSearch], it offers a maps *search* for
///    the written address and says so; the text is never presented as an exact
///    GPS point.
///  * With neither (or text but no search), it shows nothing.
class OpenLocationButton extends ConsumerWidget {
  const OpenLocationButton({
    super.key,
    required this.label,
    required this.viewerTitle,
    this.coordinates,
    this.text,
    this.allowTextSearch = false,
  });

  /// e.g. "Open Order Location", "View on Map".
  final String label;
  final String viewerTitle;
  final GeoLocation? coordinates;
  final String? text;
  final bool allowTextSearch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = LocationStrings.of(context);
    final exact = coordinates;
    final address = text?.trim() ?? '';

    if (exact != null) {
      return AppButton.outlined(
        key: const Key('open-location-exact'),
        expand: true,
        icon: Icons.location_on_outlined,
        label: label,
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => LocationViewerScreen(
              title: viewerTitle,
              location: exact,
              addressText: address,
            ),
          ),
        ),
      );
    }

    if (!allowTextSearch || address.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppButton.outlined(
          key: const Key('open-location-search'),
          expand: true,
          icon: Icons.search,
          label: label,
          onPressed: () async {
            final opened = await ref
                .read(externalMapLauncherProvider)
                .open(ExternalMapLauncher.searchUri(address));
            if (!opened && context.mounted) {
              showAppSnackBar(context, strings.couldNotOpenMaps);
            }
          },
        ),
        const SizedBox(height: 4),
        Text(
          strings.addressApproximate,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurface
                .withValues(alpha: 0.6),
          ),
        ),
      ],
    );
  }
}

/// A saved COMPANY location (profile / company details): the written address
/// plus a map action only when exact coordinates exist. Text-only legacy
/// companies just show their text; there is no broken map action.
class CompanyLocationBlock extends StatelessWidget {
  const CompanyLocationBlock({
    super.key,
    required this.text,
    required this.coordinates,
    required this.actionLabel,
    required this.viewerTitle,
  });

  final String? text;
  final GeoLocation? coordinates;
  final String actionLabel;
  final String viewerTitle;

  @override
  Widget build(BuildContext context) {
    final address = text?.trim() ?? '';
    if (address.isEmpty && coordinates == null) {
      return const SizedBox.shrink();
    }
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (address.isNotEmpty)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.location_on_outlined,
                size: 16,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  address,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        if (coordinates != null) ...[
          if (address.isNotEmpty) const SizedBox(height: 8),
          OpenLocationButton(
            label: actionLabel,
            viewerTitle: viewerTitle,
            coordinates: coordinates,
            text: address,
          ),
        ],
      ],
    );
  }
}

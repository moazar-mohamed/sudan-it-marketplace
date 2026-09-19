import 'package:flutter/material.dart';

import '../../domain/geo_location.dart';
import '../location_strings.dart';
import '../map_picker_screen.dart';
import 'map_widgets.dart';

/// Form section with BOTH ways to give a location:
///   1. type the address, and/or
///   2. pick the exact point on a map.
/// The map is an addition, never a replacement: the text field is always
/// there and works without any device permission.
class LocationField extends StatelessWidget {
  const LocationField({
    super.key,
    required this.textController,
    required this.location,
    required this.onLocationChanged,
    this.enabled = true,
    this.textLabel,
    this.textHint,
    this.errorText,
    this.maxLines = 2,
  });

  final TextEditingController textController;
  final GeoLocation? location;
  final ValueChanged<GeoLocation?> onLocationChanged;
  final bool enabled;
  final String? textLabel;
  final String? textHint;

  /// Shown under the field, e.g. "enter an address or select on the map".
  final String? errorText;
  final int maxLines;

  Future<void> _pick(BuildContext context) async {
    final picked = await MapPickerScreen.open(
      context,
      initialLocation: location,
    );
    if (picked != null) {
      onLocationChanged(picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = LocationStrings.of(context);
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final selected = location;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          strings.location,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        TextFormField(
          key: const Key('location-text-field'),
          controller: textController,
          enabled: enabled,
          minLines: 1,
          maxLines: maxLines,
          decoration: InputDecoration(
            labelText: textLabel ?? strings.enterAddress,
            hintText: textHint,
            prefixIcon: const Icon(Icons.location_on_outlined),
            alignLabelWithHint: maxLines > 1,
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              const Expanded(child: Divider()),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  strings.or,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ),
              const Expanded(child: Divider()),
            ],
          ),
        ),
        if (selected == null)
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              key: const Key('location-select-on-map'),
              onPressed: enabled ? () => _pick(context) : null,
              icon: const Icon(Icons.location_on),
              label: Text(strings.selectOnMap),
            ),
          )
        else
          Container(
            key: const Key('location-selected-card'),
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: colorScheme.primary.withValues(alpha: 0.25),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.location_on, color: colorScheme.error, size: 20),
                    const SizedBox(width: 6),
                    Text(
                      strings.locationSelected,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                CoordinatesText(location: selected),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 8,
                  children: [
                    TextButton.icon(
                      key: const Key('location-change'),
                      onPressed: enabled ? () => _pick(context) : null,
                      icon: const Icon(
                        Icons.edit_location_alt_outlined,
                        size: 18,
                      ),
                      label: Text(strings.changeLocation),
                    ),
                    TextButton.icon(
                      key: const Key('location-remove'),
                      onPressed: enabled ? () => onLocationChanged(null) : null,
                      icon: const Icon(Icons.close, size: 18),
                      label: Text(strings.removeMapLocation),
                    ),
                  ],
                ),
              ],
            ),
          ),
        if (errorText != null) ...[
          const SizedBox(height: 8),
          Text(
            errorText!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colorScheme.error,
            ),
          ),
        ],
      ],
    );
  }
}

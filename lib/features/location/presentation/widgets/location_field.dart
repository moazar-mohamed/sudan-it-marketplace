import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
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
    final selected = location;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppTextField(
          key: const Key('location-text-field'),
          label: textLabel ?? strings.location,
          hint: textHint ?? strings.enterAddress,
          controller: textController,
          enabled: enabled,
          minLines: 1,
          maxLines: maxLines,
          prefixIcon: Icons.location_on_outlined,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.s12),
          child: Row(
            children: [
              const Expanded(child: Divider()),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s12),
                child: Text(
                  strings.or,
                  style: AppTextStyles.caption
                      .copyWith(color: AppColors.textSecondary),
                ),
              ),
              const Expanded(child: Divider()),
            ],
          ),
        ),
        if (selected == null)
          AppButton.outlined(
            key: const Key('location-select-on-map'),
            label: strings.selectOnMap,
            icon: Icons.location_on,
            expand: true,
            onPressed: enabled ? () => _pick(context) : null,
          )
        else
          AppCard(
            key: const Key('location-selected-card'),
            color: AppColors.brandPrimarySubtle,
            borderColor: AppColors.brandPrimarySubtleStrong,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.location_on,
                      color: AppColors.error,
                      size: AppSize.iconMd,
                    ),
                    const SizedBox(width: AppSpacing.s6),
                    Text(strings.locationSelected, style: AppTextStyles.bodyStrong),
                  ],
                ),
                const SizedBox(height: AppSpacing.s8),
                CoordinatesText(location: selected),
                const SizedBox(height: AppSpacing.s4),
                Wrap(
                  spacing: AppSpacing.s8,
                  children: [
                    TextButton.icon(
                      key: const Key('location-change'),
                      onPressed: enabled ? () => _pick(context) : null,
                      icon: const Icon(
                        Icons.edit_location_alt_outlined,
                        size: AppSize.iconMd,
                      ),
                      label: Text(strings.changeLocation),
                    ),
                    TextButton.icon(
                      key: const Key('location-remove'),
                      onPressed: enabled ? () => onLocationChanged(null) : null,
                      icon: const Icon(Icons.close, size: AppSize.iconMd),
                      label: Text(strings.removeMapLocation),
                    ),
                  ],
                ),
              ],
            ),
          ),
        if (errorText != null) ...[
          const SizedBox(height: AppSpacing.s8),
          AppBanner(tone: AppTone.error, message: errorText!),
        ],
      ],
    );
  }
}

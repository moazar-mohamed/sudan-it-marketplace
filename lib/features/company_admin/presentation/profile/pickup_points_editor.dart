import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../companies/domain/entities/pickup_point.dart';
import '../../../location/domain/geo_location.dart';
import '../../../location/presentation/widgets/location_field.dart';

/// Where customers collect orders: the company's own location (the default),
/// or up to [PickupPoint.maxPerCompany] points of its own, each with a name, a
/// written address and/or a map point.
///
/// The screen reads the result through its [GlobalKey]: [value] is the list to
/// save (empty = the company's own location) and [validate] reports the
/// "address or map point" rule the name fields' own validators cannot see.
class PickupPointsEditor extends StatefulWidget {
  const PickupPointsEditor({
    super.key,
    required this.initial,
    this.enabled = true,
  });

  final List<PickupPoint> initial;
  final bool enabled;

  @override
  State<PickupPointsEditor> createState() => PickupPointsEditorState();
}

class _Draft {
  _Draft(PickupPoint? point)
      : name = TextEditingController(text: point?.name ?? ''),
        address = TextEditingController(text: point?.address ?? ''),
        location = point?.coordinates;

  final TextEditingController name;
  final TextEditingController address;
  GeoLocation? location;
  bool placeMissing = false;

  void dispose() {
    name.dispose();
    address.dispose();
  }
}

class PickupPointsEditorState extends State<PickupPointsEditor> {
  late bool _custom = widget.initial.isNotEmpty;
  late final List<_Draft> _drafts = [
    for (final point in widget.initial) _Draft(point),
  ];

  /// The points to save; empty when the company's own location is used.
  List<PickupPoint> get value {
    if (!_custom) {
      return const [];
    }
    return [
      for (final draft in _drafts)
        PickupPoint(
          name: draft.name.text.trim(),
          address: draft.address.text.trim(),
          latitude: draft.location?.latitude,
          longitude: draft.location?.longitude,
        ),
    ];
  }

  /// False (and the points are marked) when a point has neither an address
  /// nor a map point.
  bool validate() {
    var ok = true;
    if (!_custom) {
      return ok;
    }
    setState(() {
      for (final draft in _drafts) {
        draft.placeMissing =
            draft.address.text.trim().isEmpty && draft.location == null;
        if (draft.placeMissing) {
          ok = false;
        }
      }
    });
    return ok;
  }

  @override
  void dispose() {
    for (final draft in _drafts) {
      draft.dispose();
    }
    super.dispose();
  }

  void _setCustom(bool custom) {
    if (_custom == custom) {
      return;
    }
    setState(() {
      _custom = custom;
      if (custom && _drafts.isEmpty) {
        _drafts.add(_Draft(null));
      }
    });
  }

  void _add() {
    if (_drafts.length >= PickupPoint.maxPerCompany) {
      return;
    }
    setState(() => _drafts.add(_Draft(null)));
  }

  void _remove(int index) {
    setState(() {
      _drafts.removeAt(index).dispose();
      if (_drafts.isEmpty) {
        _custom = false;
      }
    });
  }

  Widget _modeTile({
    required Key key,
    required bool selected,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      key: key,
      borderRadius: AppRadius.mdAll,
      onTap: widget.enabled ? onTap : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected
                  ? context.colors.brandPrimary
                  : context.colors.textSecondary,
            ),
            const SizedBox(width: AppSpacing.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTextStyles.bodyStrong),
                  if (subtitle != null)
                    Text(
                      subtitle,
                      style: AppTextStyles.caption
                          .copyWith(color: context.colors.textSecondary),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pointCard(int index) {
    final l10n = context.l10n;
    final draft = _drafts[index];
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s12),
      child: AppCard(
        key: ValueKey('pickup-point-$index'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.storefront_outlined, size: AppSize.iconMd),
                const SizedBox(width: AppSpacing.s8),
                Expanded(
                  child: Text(
                    l10n.pickupPointTitle(index + 1),
                    style: AppTextStyles.bodyStrong,
                  ),
                ),
                IconButton(
                  key: ValueKey('pickup-point-remove-$index'),
                  tooltip: l10n.pickupRemovePoint,
                  onPressed: widget.enabled ? () => _remove(index) : null,
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s8),
            AppTextField(
              key: ValueKey('pickup-point-name-$index'),
              label: l10n.pickupPointName,
              hint: l10n.pickupPointNameHint,
              controller: draft.name,
              enabled: widget.enabled,
              prefixIcon: Icons.label_outline,
              inputFormatters: [
                LengthLimitingTextInputFormatter(PickupPoint.maxNameLength),
              ],
              validator: (value) => (value?.trim().isEmpty ?? true)
                  ? l10n.pickupPointNameRequired
                  : null,
            ),
            const SizedBox(height: AppSpacing.s12),
            LocationField(
              textController: draft.address,
              location: draft.location,
              enabled: widget.enabled,
              maxTextLength: PickupPoint.maxAddressLength,
              errorText: draft.placeMissing
                  ? l10n.pickupPointPlaceRequired
                  : null,
              onLocationChanged: (location) => setState(() {
                draft.location = location;
                draft.placeMissing = false;
              }),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.adminPickupAddress, style: AppTextStyles.bodyStrong),
        const SizedBox(height: AppSpacing.s4),
        _modeTile(
          key: const ValueKey('pickup-mode-company'),
          selected: !_custom,
          title: l10n.pickupModeCompany,
          subtitle: l10n.pickupModeCompanyHint,
          onTap: () => _setCustom(false),
        ),
        _modeTile(
          key: const ValueKey('pickup-mode-custom'),
          selected: _custom,
          title: l10n.pickupModeCustom,
          subtitle: l10n.pickupPointsHint(PickupPoint.maxPerCompany),
          onTap: () => _setCustom(true),
        ),
        if (_custom) ...[
          const SizedBox(height: AppSpacing.s12),
          for (var i = 0; i < _drafts.length; i++) _pointCard(i),
          if (_drafts.length < PickupPoint.maxPerCompany)
            AppButton.outlined(
              key: const ValueKey('pickup-point-add'),
              label: l10n.pickupAddPoint,
              icon: Icons.add_location_alt_outlined,
              expand: true,
              onPressed: widget.enabled ? _add : null,
            ),
        ],
        const SizedBox(height: AppSpacing.s16),
      ],
    );
  }
}

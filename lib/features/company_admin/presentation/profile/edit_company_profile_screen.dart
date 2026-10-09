import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/image_upload_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../core/widgets/image_picker_field.dart';
import '../../../../core/widgets/image_picker_strings.dart';
import '../../../cities/data/city_announcer.dart';
import '../../../cities/domain/sudan_city.dart';
import '../../../cities/presentation/city_picker_sheets.dart';
import '../../../cities/presentation/city_providers.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../location/domain/geo_location.dart';
import '../../../location/presentation/widgets/location_field.dart';
import '../company_admin_actions.dart';
import '../../../../core/localization/l10n_extension.dart';

class EditCompanyProfileScreen extends ConsumerStatefulWidget {
  const EditCompanyProfileScreen({super.key, required this.company});

  final Company company;

  @override
  ConsumerState<EditCompanyProfileScreen> createState() =>
      _EditCompanyProfileScreenState();
}

class _EditCompanyProfileScreenState
    extends ConsumerState<EditCompanyProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final ImagePickerController _logoController;
  late final TextEditingController _nameController;
  late final PhoneController _phoneController;
  late final TextEditingController _emailController;
  late final TextEditingController _cityController;
  late final TextEditingController _addressController;
  late final TextEditingController _pickupController;
  late final TextEditingController _descriptionController;
  GeoLocation? _coordinates;
  List<String> _serviceCityIds = const [];
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final c = widget.company;
    _coordinates = c.coordinates;
    _serviceCityIds = c.serviceCityIds;
    _logoController = ImagePickerController(url: c.logoUrl);
    _nameController = TextEditingController(text: c.name);
    _phoneController = PhoneController(text: c.phone ?? '');
    _emailController = TextEditingController(text: c.email ?? '');
    _cityController = TextEditingController(text: c.city ?? '');
    _addressController = TextEditingController(text: c.address ?? '');
    _pickupController = TextEditingController(text: c.pickupAddress ?? '');
    _descriptionController = TextEditingController(text: c.description ?? '');
  }

  @override
  void dispose() {
    for (final controller in [
      _logoController,
      _nameController,
      _phoneController,
      _emailController,
      _cityController,
      _addressController,
      _pickupController,
      _descriptionController,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_isSaving || !(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _isSaving = true);

    final String logoUrl;
    try {
      logoUrl = await _logoController.resolveUrl(
        ref.read(imageUploadServiceProvider),
        folder: 'company-logos/${widget.company.id}',
      );
    } on ImageUploadException {
      if (!mounted) {
        return;
      }
      setState(() => _isSaving = false);
      showAppSnackBar(
        context,
        ImagePickerStrings.of(context).uploadFailed,
        tone: AppTone.error,
      );
      return;
    }

    final updated = widget.company.copyWith(
      logoUrl: logoUrl,
      name: _nameController.text.trim(),
      phone: _phoneController.value,
      email: _emailController.text.trim(),
      city: _cityController.text.trim(),
      address: _addressController.text.trim(),
      coordinates: _coordinates,
      clearCoordinates: _coordinates == null,
      pickupAddress: _pickupController.text.trim(),
      description: _descriptionController.text.trim(),
      serviceCityIds: _serviceCityIds,
    );

    final announcer = ref.read(cityAnnouncerProvider);
    final error = await ref
        .read(companyAdminActionsProvider)
        .updateCompanyProfile(updated);
    if (!mounted) {
      return;
    }
    setState(() => _isSaving = false);
    showAppSnackBar(
      context,
      error ?? context.l10n.adminCompanyProfileUpdated,
      tone: error == null ? AppTone.success : AppTone.error,
    );
    if (error == null) {
      // Customers of the cities just added are told, without waiting for it.
      final added = CityAnnouncer.addedCities(
        widget.company.serviceCityIds,
        updated.serviceCityIds,
      );
      if (added.isNotEmpty && widget.company.isActive) {
        unawaited(
          announcer.announce(
            companyId: updated.id,
            companyName: updated.name,
            cityIds: added,
          ),
        );
      }
      Navigator.of(context).pop();
    }
  }

  Widget _field(
    TextEditingController controller,
    String label,
    IconData icon, {
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    String? Function(String?)? validator,
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s16),
      child: AppTextField(
        label: label,
        controller: controller,
        enabled: !_isSaving,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        maxLines: maxLines,
        minLines: 1,
        validator: validator,
        prefixIcon: icon,
      ),
    );
  }

  Future<void> _chooseServiceCities() async {
    final chosen = await showCityMultiPickerSheet(
      context,
      selectedIds: _serviceCityIds,
    );
    if (chosen != null && mounted) {
      setState(() => _serviceCityIds = chosen);
    }
  }

  Widget _serviceCitiesField() {
    final l10n = context.l10n;
    final language = Localizations.localeOf(context).languageCode;
    final text = _serviceCityIds.isEmpty
        ? l10n.cityServiceAreaAll
        : cityNamesText(_serviceCityIds, language);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s16),
      child: InkWell(
        key: const ValueKey('service-cities-field'),
        borderRadius: AppRadius.mdAll,
        onTap: _isSaving ? null : _chooseServiceCities,
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: l10n.cityServiceAreaTitle,
            helperText: l10n.cityServiceAreaHint,
            helperMaxLines: 3,
            prefixIcon: const Icon(Icons.map_outlined),
            suffixIcon: const Icon(Icons.arrow_drop_down),
          ),
          child: Text(text),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(citiesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.adminEditCompanyProfile)),
      body: Form(
        key: _formKey,
        child: AppCenteredList(
          bottomPadding: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.s24,
          children: [
            ImagePickerField(
              controller: _logoController,
              enabled: !_isSaving,
              fallbackIcon: Icons.business_outlined,
            ),
            const SizedBox(height: AppSpacing.s16),
            _field(
              _nameController,
              context.l10n.adminCompanyName,
              Icons.business_outlined,
              validator: (value) => (value?.trim().isEmpty ?? true)
                  ? context.l10n.adminCompanyNameRequired
                  : null,
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s16),
              child: PhoneField(
                label: context.l10n.adminPhone,
                controller: _phoneController,
                enabled: !_isSaving,
              ),
            ),
            _field(
              _emailController,
              context.l10n.authEmail,
              Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.isEmpty) {
                  return null;
                }
                return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(text)
                    ? null
                    : context.l10n.authEmailInvalid;
              },
            ),
            _field(_cityController, context.l10n.adminCity, Icons.location_city_outlined),
            _serviceCitiesField(),
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s16),
              child: LocationField(
                textController: _addressController,
                location: _coordinates,
                enabled: !_isSaving,
                onLocationChanged: (value) =>
                    setState(() => _coordinates = value),
              ),
            ),
            _field(
              _pickupController,
              context.l10n.adminPickupAddress,
              Icons.storefront_outlined,
              maxLines: 2,
            ),
            _field(
              _descriptionController,
              context.l10n.adminShortDescription,
              Icons.notes_outlined,
              maxLines: 4,
            ),
            const SizedBox(height: AppSpacing.s8),
            AppButton.primary(
              expand: true,
              loading: _isSaving,
              label: context.l10n.commonSaveChanges,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}

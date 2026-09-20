import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/image_upload_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/image_picker_field.dart';
import '../../../../core/widgets/image_picker_strings.dart';
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
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late final TextEditingController _cityController;
  late final TextEditingController _addressController;
  late final TextEditingController _pickupController;
  late final TextEditingController _descriptionController;
  GeoLocation? _coordinates;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final c = widget.company;
    _coordinates = c.coordinates;
    _logoController = ImagePickerController(url: c.logoUrl);
    _nameController = TextEditingController(text: c.name);
    _phoneController = TextEditingController(text: c.phone ?? '');
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ImagePickerStrings.of(context).uploadFailed),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final updated = widget.company.copyWith(
      logoUrl: logoUrl,
      name: _nameController.text.trim(),
      phone: _phoneController.text.trim(),
      email: _emailController.text.trim(),
      city: _cityController.text.trim(),
      address: _addressController.text.trim(),
      coordinates: _coordinates,
      clearCoordinates: _coordinates == null,
      pickupAddress: _pickupController.text.trim(),
      description: _descriptionController.text.trim(),
    );

    final error = await ref
        .read(companyAdminActionsProvider)
        .updateCompanyProfile(updated);
    if (!mounted) {
      return;
    }
    setState(() => _isSaving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(error ?? context.l10n.adminCompanyProfileUpdated),
        backgroundColor: error == null ? null : AppColors.error,
      ),
    );
    if (error == null) {
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
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        enabled: !_isSaving,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        maxLines: maxLines,
        minLines: 1,
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon),
          alignLabelWithHint: maxLines > 1,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.adminEditCompanyProfile)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            16,
            16,
            16,
            MediaQuery.viewInsetsOf(context).bottom + 24,
          ),
          children: [
            ImagePickerField(
              controller: _logoController,
              enabled: !_isSaving,
              fallbackIcon: Icons.business_outlined,
            ),
            const SizedBox(height: 16),
            _field(
              _nameController,
              context.l10n.adminCompanyName,
              Icons.business_outlined,
              validator: (value) => (value?.trim().isEmpty ?? true)
                  ? context.l10n.adminCompanyNameRequired
                  : null,
            ),
            _field(
              _phoneController,
              context.l10n.adminPhone,
              Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
              ],
              validator: (value) {
                final digits =
                    (value ?? '').replaceAll(RegExp(r'[^0-9]'), '');
                if (digits.isEmpty) {
                  return null;
                }
                return digits.length < 9 ? context.l10n.commonPhoneInvalid : null;
              },
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
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
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
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _isSaving ? null : _save,
              child: _isSaving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: AppColors.onPrimary,
                      ),
                    )
                  : Text(context.l10n.commonSaveChanges),
            ),
          ],
        ),
      ),
    );
  }
}

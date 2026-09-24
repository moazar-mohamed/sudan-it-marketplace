import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../technicians/domain/entities/technician.dart';
import '../../../auth/presentation/password_change_strings.dart';
import '../company_admin_actions.dart';
import '../../../../core/localization/l10n_extension.dart';

/// Add Technician (creates the technician's login with a temporary password)
/// and Edit Technician share this form.
class TechnicianFormScreen extends ConsumerStatefulWidget {
  const TechnicianFormScreen.add({super.key, required this.companyId})
      : technician = null;

  TechnicianFormScreen.edit({super.key, required Technician this.technician})
      : companyId = technician.companyId;

  final String companyId;
  final Technician? technician;

  bool get isEditing => technician != null;

  @override
  ConsumerState<TechnicianFormScreen> createState() =>
      _TechnicianFormScreenState();
}

class _TechnicianFormScreenState extends ConsumerState<TechnicianFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fullNameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  final _passwordController = TextEditingController();
  late bool _isActive;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final technician = widget.technician;
    _fullNameController = TextEditingController(text: technician?.fullName ?? '');
    _phoneController = TextEditingController(text: technician?.phone ?? '');
    _emailController = TextEditingController(text: technician?.email ?? '');
    _isActive = technician?.isActive ?? true;
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_isSaving) {
      return;
    }
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final actions = ref.read(companyAdminActionsProvider);
    final existing = widget.technician;
    final email = _emailController.text.trim();

    setState(() => _isSaving = true);
    final String? error;
    if (existing == null) {
      // The company admin gives the technician a temporary password. The
      // technician is made to choose their own the first time they sign in.
      error = await actions.createTechnicianAccount(
        companyId: widget.companyId,
        fullName: _fullNameController.text.trim(),
        phone: _phoneController.text.trim(),
        email: email,
        password: _passwordController.text,
      );
    } else {
      final technician = Technician(
        id: existing.id,
        companyId: widget.companyId,
        fullName: _fullNameController.text.trim(),
        phone: _phoneController.text.trim(),
        email: email.isEmpty ? null : email,
        uid: existing.uid,
        isActive: _isActive,
      );
      error = await actions.updateTechnician(technician);
    }
    if (!mounted) {
      return;
    }
    setState(() => _isSaving = false);

    if (error != null) {
      // Errors stay 6 s: long enough to read a specific reason and act on it.
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    showAppSnackBar(
      context,
      existing == null
          ? context.l10n.adminTechnicianCreated
          : context.l10n.adminTechnicianUpdated,
      tone: AppTone.success,
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEditing ? context.l10n.adminEditTechnician : context.l10n.adminAddTechnician),
      ),
      body: SafeArea(
        top: false,
        child: Form(
          key: _formKey,
          child: AppCenteredList(
            bottomPadding: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.s24,
            children: [
              if (!widget.isEditing) ...[
                AppBanner(
                  tone: AppTone.info,
                  message: context.l10n.adminTechnicianAccountNote,
                ),
                const SizedBox(height: AppSpacing.s16),
              ],
              AppTextField(
                label: context.l10n.authFullName,
                controller: _fullNameController,
                enabled: !_isSaving,
                textCapitalization: TextCapitalization.words,
                prefixIcon: Icons.person_outline,
                validator: (value) => (value?.trim().isEmpty ?? true)
                    ? context.l10n.adminTechnicianNameRequired
                    : null,
              ),
              const SizedBox(height: AppSpacing.s16),
              AppTextField(
                label: context.l10n.adminPhone,
                controller: _phoneController,
                enabled: !_isSaving,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
                ],
                prefixIcon: Icons.phone_outlined,
                validator: (value) {
                  final digits =
                      (value ?? '').replaceAll(RegExp(r'[^0-9]'), '');
                  if (digits.isEmpty) {
                    return context.l10n.adminPhoneRequired;
                  }
                  return digits.length < 9
                      ? context.l10n.commonPhoneInvalid
                      : null;
                },
              ),
              const SizedBox(height: AppSpacing.s16),
              AppTextField(
                label: context.l10n.authEmail,
                controller: _emailController,
                enabled: !_isSaving && !widget.isEditing,
                keyboardType: TextInputType.emailAddress,
                prefixIcon: Icons.email_outlined,
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) {
                    return widget.isEditing
                        ? null
                        : context.l10n.adminTechnicianEmailRequired;
                  }
                  return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(text)
                      ? null
                      : context.l10n.authEmailInvalid;
                },
              ),
              if (!widget.isEditing) ...[
                const SizedBox(height: AppSpacing.s16),
                AppTextField(
                  label: context.l10n.adminTechnicianTempPassword,
                  controller: _passwordController,
                  enabled: !_isSaving,
                  password: true,
                  prefixIcon: Icons.lock_outline,
                  validator: (value) {
                    final text = value ?? '';
                    if (text.isEmpty) {
                      return context.l10n.adminTechnicianPasswordRequired;
                    }
                    return text.length < PasswordChangeStrings.minLength
                        ? context.l10n.passwordChangeTooShort(
                            PasswordChangeStrings.minLength,
                          )
                        : null;
                  },
                ),
              ],
              if (widget.isEditing) ...[
                const SizedBox(height: AppSpacing.s8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _isActive,
                  onChanged: _isSaving
                      ? null
                      : (value) => setState(() => _isActive = value),
                  title: Text(context.l10n.adminActive),
                  subtitle: Text(context.l10n.adminInactiveTechnicianNote),
                ),
              ],
              const SizedBox(height: AppSpacing.s24),
              AppButton.primary(
                expand: true,
                loading: _isSaving,
                label: widget.isEditing
                    ? context.l10n.commonSaveChanges
                    : context.l10n.adminAddTechnicianSubmit,
                onPressed: _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

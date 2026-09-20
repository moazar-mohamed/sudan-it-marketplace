import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../technicians/domain/entities/technician.dart';
import '../company_admin_actions.dart';
import '../../../../core/localization/l10n_extension.dart';

/// Add Technician (creates a pending invitation) and Edit Technician share
/// this form.
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
      // Adding a technician only creates a pending invitation; the
      // technician claims it themself by registering with this same email
      // through the normal Register screen. The company admin never
      // creates the technician's Firebase Auth account directly.
      error = await actions.createTechnicianInvite(
        companyId: widget.companyId,
        fullName: _fullNameController.text.trim(),
        phone: _phoneController.text.trim(),
        email: email,
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: AppColors.error),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          existing == null
              ? context.l10n.adminInvitationCreated
              : context.l10n.adminTechnicianUpdated,
        ),
      ),
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
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              16,
              16,
              16,
              MediaQuery.viewInsetsOf(context).bottom + 24,
            ),
            children: [
              if (!widget.isEditing) ...[
                Text(
                  context.l10n.adminInviteNote,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.65),
                      ),
                ),
                const SizedBox(height: 14),
              ],
              TextFormField(
                controller: _fullNameController,
                enabled: !_isSaving,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(
                  labelText: context.l10n.authFullName,
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (value) => (value?.trim().isEmpty ?? true)
                    ? context.l10n.adminTechnicianNameRequired
                    : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _phoneController,
                enabled: !_isSaving,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
                ],
                decoration: InputDecoration(
                  labelText: context.l10n.adminPhone,
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                validator: (value) {
                  final digits =
                      (value ?? '').replaceAll(RegExp(r'[^0-9]'), '');
                  if (digits.isEmpty) {
                    return context.l10n.adminPhoneRequired;
                  }
                  return digits.length < 9 ? context.l10n.commonPhoneInvalid : null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _emailController,
                enabled: !_isSaving && !widget.isEditing,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: context.l10n.authEmail,
                  prefixIcon: Icon(Icons.email_outlined),
                ),
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
              if (widget.isEditing) ...[
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _isActive,
                  onChanged: _isSaving
                      ? null
                      : (value) => setState(() => _isActive = value),
                  title: Text(context.l10n.adminActive),
                  subtitle: Text(
                    context.l10n.adminInactiveTechnicianNote,
                  ),
                ),
              ],
              const SizedBox(height: 28),
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
                    : Text(widget.isEditing ? context.l10n.commonSaveChanges : context.l10n.adminSendInvitation),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

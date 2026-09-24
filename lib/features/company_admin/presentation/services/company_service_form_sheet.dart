import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';

/// Saves the company's price (null when left empty) and note; returns null
/// on success or a user-facing error.
typedef CompanyServiceSave = Future<String?> Function(
  double? price,
  String note,
);

/// Asks for the company's optional price and note for a catalogue service.
Future<void> showCompanyServiceForm(
  BuildContext context, {
  required String serviceName,
  required CompanyServiceSave onSave,
  double? initialPrice,
  String? initialNote,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _CompanyServiceForm(
      serviceName: serviceName,
      onSave: onSave,
      initialPrice: initialPrice,
      initialNote: initialNote,
    ),
  );
}

class _CompanyServiceForm extends StatefulWidget {
  const _CompanyServiceForm({
    required this.serviceName,
    required this.onSave,
    this.initialPrice,
    this.initialNote,
  });

  final String serviceName;
  final CompanyServiceSave onSave;
  final double? initialPrice;
  final String? initialNote;

  @override
  State<_CompanyServiceForm> createState() => _CompanyServiceFormState();
}

class _CompanyServiceFormState extends State<_CompanyServiceForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _priceController;
  late final TextEditingController _noteController;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final price = widget.initialPrice;
    _priceController = TextEditingController(
      text: price == null
          ? ''
          : (price == price.roundToDouble()
              ? price.toStringAsFixed(0)
              : price.toString()),
    );
    _noteController = TextEditingController(text: widget.initialNote ?? '');
  }

  @override
  void dispose() {
    _priceController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  /// Empty is allowed (no price); a given price must be greater than 0.
  String? _validatePrice(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null;
    final number = double.tryParse(text);
    return number == null || number <= 0
        ? context.l10n.formPriceInvalid
        : null;
  }

  Future<void> _save() async {
    if (_saving || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    // An empty field is stored as no price (null), never as 0.
    final price = double.tryParse(_priceController.text.trim());
    final error = await widget.onSave(price, _noteController.text.trim());
    if (!mounted) return;
    setState(() => _saving = false);
    final messenger = ScaffoldMessenger.of(context);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error, messenger: messenger);
      return;
    }
    final savedMessage = context.l10n.adminServiceSaved;
    Navigator.of(context).pop();
    showAppSnackBar(
      context,
      savedMessage,
      tone: AppTone.success,
      messenger: messenger,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.s16,
        0,
        AppSpacing.s16,
        AppSpacing.s16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.serviceName, style: AppTextStyles.h2),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              label: context.l10n.formPriceOptional,
              controller: _priceController,
              enabled: !_saving,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              helperText: context.l10n.adminServicePriceHelper,
              prefixIcon: Icons.payments_outlined,
              validator: _validatePrice,
            ),
            const SizedBox(height: AppSpacing.s12),
            AppTextField(
              label: context.l10n.adminServiceNoteLabel,
              controller: _noteController,
              enabled: !_saving,
              minLines: 2,
              maxLines: 4,
              maxLength: 500,
              hint: context.l10n.adminServiceNoteHint,
            ),
            const SizedBox(height: AppSpacing.s8),
            AppButton.primary(
              label: context.l10n.commonSave,
              loading: _saving,
              expand: true,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}

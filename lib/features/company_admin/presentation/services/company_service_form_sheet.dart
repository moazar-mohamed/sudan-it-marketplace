import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/localization/l10n_extension.dart';

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
      messenger.showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    final savedMessage = context.l10n.adminServiceSaved;
    Navigator.of(context).pop();
    messenger.showSnackBar(SnackBar(content: Text(savedMessage)));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        0,
        16,
        16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.serviceName,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _priceController,
              enabled: !_saving,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              decoration: InputDecoration(
                labelText: context.l10n.formPriceOptional,
                helperText: context.l10n.adminServicePriceHelper,
                helperMaxLines: 2,
                prefixIcon: const Icon(Icons.payments_outlined),
              ),
              validator: _validatePrice,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _noteController,
              enabled: !_saving,
              minLines: 2,
              maxLines: 4,
              maxLength: 500,
              decoration: InputDecoration(
                labelText: context.l10n.adminServiceNoteLabel,
                hintText: context.l10n.adminServiceNoteHint,
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2),
                    )
                  : Text(context.l10n.commonSave),
            ),
          ],
        ),
      ),
    );
  }
}

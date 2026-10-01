import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/phone_countries.dart';
import '../localization/l10n_extension.dart';
import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';
import '../utils/phone_number.dart';
import 'app_text_field.dart';
import 'phone_country_sheet.dart';

/// What a [PhoneField] holds: the chosen country code and the typed national
/// number. Read [value] for the number to save (`+249912345678`, or '').
class PhoneController extends ChangeNotifier {
  PhoneController({String? text}) {
    this.text = text ?? '';
    national.addListener(_onTyped);
  }

  /// The digits typed after the country code.
  final national = TextEditingController();
  PhoneCountry _country = PhoneCountries.sudan;

  PhoneCountry get country => _country;

  set country(PhoneCountry value) {
    if (value == _country) return;
    _country = value;
    notifyListeners();
  }

  PhoneNumber get number =>
      PhoneNumber(_country, PhoneNumber.cleanNational(national.text, _country));

  String get value => number.e164;

  /// Shows a saved number: its country code is selected and the rest typed.
  set text(String raw) {
    final parsed = PhoneNumber.parse(raw);
    _country = parsed.country;
    national.text = parsed.national;
    notifyListeners();
  }

  /// A whole number pasted or typed with its code (`+249...`, `00249...`)
  /// selects that country and keeps only the national part.
  void _onTyped() {
    final typed = national.text.trim();
    final String digits;
    if (typed.startsWith('+')) {
      digits = typed.replaceAll(RegExp(r'[^0-9]'), '');
    } else if (typed.startsWith('00')) {
      digits = typed.replaceAll(RegExp(r'[^0-9]'), '').substring(2);
    } else {
      return;
    }
    final split = PhoneNumber.splitInternational(digits);
    if (split == null) return;
    _country = split.country;
    national.value = TextEditingValue(
      text: split.national,
      selection: TextSelection.collapsed(offset: split.national.length),
    );
    notifyListeners();
  }

  @override
  void dispose() {
    national.dispose();
    super.dispose();
  }
}

/// Phone number input: the country code (flag and `+249`) is chosen from a
/// list at the start of the field, and the number is typed after it. The
/// field reads left to right in Arabic too, like the number itself.
///
/// It validates itself inside a [Form]: [requiredMessage] when a required
/// number is left empty, and the country's length rule otherwise.
class PhoneField extends StatefulWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.label,
    this.helperText,
    this.optional = false,
    this.requiredMessage,
    this.enabled = true,
    this.textInputAction,
  });

  final PhoneController controller;
  final String? label;
  final String? helperText;

  /// Adds the localized "Optional" hint after the label.
  final bool optional;

  /// Set for a required number; shown when it is left empty.
  final String? requiredMessage;
  final bool enabled;
  final TextInputAction? textInputAction;

  @override
  State<PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<PhoneField> {
  final _fieldKey = GlobalKey<FormFieldState<String>>();

  PhoneController get controller => widget.controller;

  String? _validate(BuildContext context) {
    final number = controller.number;
    if (number.isEmpty) return widget.requiredMessage;
    if (number.hasValidLength) return null;
    final country = number.country;
    return country.minLength == country.maxLength
        ? context.l10n.phoneDigitsExact(
            country.minLength,
            keepLeftToRight(country.plusCode),
          )
        : context.l10n.commonPhoneInvalid;
  }

  Future<void> _chooseCountry(BuildContext context) async {
    final picked = await showPhoneCountryPicker(
      context,
      selected: controller.country,
    );
    if (picked == null) return;
    controller.country = picked;
    // An error about the old country's length no longer applies.
    if (_fieldKey.currentState?.hasError ?? false) {
      _fieldKey.currentState!.validate();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Messages under the field keep the screen's direction.
    final direction = Directionality.of(context);
    Widget message(String text, {required bool isError}) => Directionality(
          textDirection: direction,
          child: AppFieldMessage(message: text, isError: isError),
        );

    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final country = controller.country;
        final enabled = widget.enabled;
        return AppLabeledField(
          label: widget.label,
          optional: widget.optional,
          enabled: enabled,
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: TextFormField(
              key: _fieldKey,
              controller: controller.national,
              enabled: enabled,
              keyboardType: TextInputType.phone,
              textInputAction: widget.textInputAction,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
              ],
              autofillHints: const [AutofillHints.telephoneNumberNational],
              validator: (_) => _validate(context),
              style: enabled
                  ? AppTextStyles.body
                  : AppTextStyles.body
                      .copyWith(color: context.colors.textSecondary),
              cursorColor: context.colors.iconBrand,
              errorBuilder: (_, text) => message(text, isError: true),
              decoration: InputDecoration(
                hintText: country.example,
                prefixIcon: _CountryCodeButton(
                  country: country,
                  enabled: enabled,
                  onTap: () => _chooseCountry(context),
                ),
                filled: true,
                fillColor: enabled
                    ? context.colors.surface
                    : context.colors.bgSubtle,
                helper: widget.helperText == null
                    ? null
                    : message(widget.helperText!, isError: false),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The flag and `+249` at the start of a [PhoneField]; opens the country list.
class _CountryCodeButton extends StatelessWidget {
  const _CountryCodeButton({
    required this.country,
    required this.enabled,
    required this.onTap,
  });

  final PhoneCountry country;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final languageCode = Localizations.localeOf(context).languageCode;
    final color =
        enabled ? context.colors.textPrimary : context.colors.textSecondary;
    return Semantics(
      button: true,
      enabled: enabled,
      label: context.l10n.phoneCountryCodeOf(
        country.name(languageCode),
        country.plusCode,
      ),
      excludeSemantics: true,
      onTap: enabled ? onTap : null,
      child: InkWell(
        key: const ValueKey('phone-country-code'),
        onTap: enabled ? onTap : null,
        borderRadius: const BorderRadiusDirectional.horizontal(
          start: Radius.circular(AppRadius.md),
        ).resolve(TextDirection.ltr),
        child: Padding(
          padding: const EdgeInsets.only(left: AppSpacing.s12),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(country.flag, style: const TextStyle(fontSize: 18)),
              const SizedBox(width: AppSpacing.s6),
              Text(
                country.plusCode,
                style: AppTextStyles.bodyStrong.copyWith(color: color),
              ),
              Icon(
                Icons.arrow_drop_down_rounded,
                size: AppSize.iconMd,
                color: context.colors.textSecondary,
              ),
              const SizedBox(width: AppSpacing.s4),
              Container(
                width: 1,
                height: 24,
                color: context.colors.borderDefault,
              ),
              const SizedBox(width: AppSpacing.s8),
            ],
          ),
        ),
      ),
    );
  }
}

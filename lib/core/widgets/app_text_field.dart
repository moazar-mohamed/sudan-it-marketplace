import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../localization/l10n_extension.dart';
import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';

/// Text input of the design system (Figma component "Text field").
///
/// The label sits ABOVE the field and never disappears; the validation message
/// replaces the helper text and always shows an icon next to the text and a red
/// border, so an error is never colour-only. A [password] field gets the
/// show/hide eye at its trailing edge.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.initialValue,
    this.validator,
    this.onChanged,
    this.onFieldSubmitted,
    this.keyboardType,
    this.textInputAction,
    this.inputFormatters,
    this.maxLines = 1,
    this.minLines,
    this.maxLength,
    this.enabled = true,
    this.readOnly = false,
    this.password = false,
    this.prefixIcon,
    this.suffix,
    this.helperText,
    this.autofillHints,
    this.focusNode,
    this.autovalidateMode,
    this.textAlign = TextAlign.start,
    this.textCapitalization = TextCapitalization.none,
    this.textDirection,
    this.optional = false,
    this.onTap,
  });

  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final String? initialValue;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLines;
  final int? minLines;
  final int? maxLength;
  final bool enabled;
  final bool readOnly;
  final bool password;
  final IconData? prefixIcon;
  final Widget? suffix;
  final String? helperText;
  final Iterable<String>? autofillHints;
  final FocusNode? focusNode;
  final AutovalidateMode? autovalidateMode;
  final TextAlign textAlign;
  final TextCapitalization textCapitalization;

  /// Forces the direction of the typed text (e-mail, phone numbers stay LTR
  /// inside an RTL screen).
  final TextDirection? textDirection;

  /// Adds the localized "Optional" hint after the label.
  final bool optional;
  final VoidCallback? onTap;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  bool _obscured = true;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final trailing = widget.password
        ? IconButton(
            tooltip: _obscured
                ? l10n.commonShowPassword
                : l10n.commonHidePassword,
            icon: Icon(
              _obscured
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
              size: AppSize.iconMd,
            ),
            onPressed: () => setState(() => _obscured = !_obscured),
          )
        : widget.suffix;

    final field = TextFormField(
      controller: widget.controller,
      initialValue: widget.controller == null ? widget.initialValue : null,
      focusNode: widget.focusNode,
      enabled: widget.enabled,
      readOnly: widget.readOnly,
      onTap: widget.onTap,
      obscureText: widget.password && _obscured,
      keyboardType: widget.password
          ? TextInputType.visiblePassword
          : widget.keyboardType,
      textInputAction: widget.textInputAction,
      inputFormatters: widget.inputFormatters,
      autofillHints: widget.autofillHints,
      autovalidateMode: widget.autovalidateMode,
      textAlign: widget.textAlign,
      textCapitalization: widget.textCapitalization,
      textDirection: widget.textDirection,
      maxLines: widget.password ? 1 : widget.maxLines,
      minLines: widget.minLines,
      maxLength: widget.maxLength,
      validator: widget.validator,
      onChanged: widget.onChanged,
      onFieldSubmitted: widget.onFieldSubmitted,
      // A read-only/disabled field is distinguished by its muted fill and
      // lighter border, NOT by pale text: label and value stay AA-readable.
      style: widget.enabled
          ? AppTextStyles.body
          : AppTextStyles.body.copyWith(color: AppColors.textSecondary),
      cursorColor: AppColors.primary,
      errorBuilder: (context, message) => _FieldMessage(
        message: message,
        isError: true,
      ),
      decoration: InputDecoration(
        hintText: widget.hint,
        counterText: widget.maxLength == null ? null : '',
        prefixIcon: widget.prefixIcon == null
            ? null
            : Icon(widget.prefixIcon, size: AppSize.iconMd),
        suffixIcon: trailing,
        filled: true,
        fillColor: widget.enabled ? AppColors.surface : AppColors.bgSubtle,
        helper: widget.helperText == null
            ? null
            : _FieldMessage(message: widget.helperText!, isError: false),
        alignLabelWithHint: true,
      ),
    );

    return _LabeledField(
      label: widget.label,
      optional: widget.optional,
      enabled: widget.enabled,
      child: field,
    );
  }
}

/// Label above a form control, shared by every field of the design system: the
/// label stays visible, is excluded from semantics (the control carries it) and
/// softens to secondary text (still AA on the page) when the control is
/// read-only or disabled.
class _LabeledField extends StatelessWidget {
  const _LabeledField({
    required this.label,
    required this.enabled,
    required this.child,
    this.optional = false,
  });

  final String? label;
  final bool enabled;
  final bool optional;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final label = this.label;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          ExcludeSemantics(
            child: Text.rich(
              TextSpan(
                text: label,
                children: [
                  if (optional)
                    TextSpan(
                      text: '  ${context.l10n.commonOptional}',
                      style: AppTextStyles.caption
                          .copyWith(color: AppColors.textSecondary),
                    ),
                ],
              ),
              style: AppTextStyles.labelLarge.copyWith(
                color: enabled ? AppColors.textPrimary : AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.s6),
        ],
        label == null ? child : Semantics(label: label, child: child),
      ],
    );
  }
}

/// Helper or validation text under a field. Errors get an icon, so the state
/// is readable without colour.
class _FieldMessage extends StatelessWidget {
  const _FieldMessage({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? AppColors.errorText : AppColors.textSecondary;
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isError) ...[
            const Padding(
              padding: EdgeInsets.only(top: 1),
              child: Icon(
                Icons.error_outline_rounded,
                size: AppSize.iconSm,
                color: AppColors.error,
              ),
            ),
            const SizedBox(width: AppSpacing.s6),
          ],
          Expanded(
            child: Text(
              message,
              style: AppTextStyles.caption.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
  }
}

/// Search box (Figma "Text field · Search"): magnifier at the start, a clear
/// button once something is typed.
class AppSearchField extends StatefulWidget {
  const AppSearchField({
    super.key,
    required this.hint,
    this.controller,
    this.onChanged,
    this.onCleared,
    this.onSubmitted,
  });

  final String hint;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onCleared;
  final ValueChanged<String>? onSubmitted;

  @override
  State<AppSearchField> createState() => _AppSearchFieldState();
}

class _AppSearchFieldState extends State<AppSearchField> {
  late final TextEditingController _controller =
      widget.controller ?? TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    _controller.removeListener(_rebuild);
    if (widget.controller == null) _controller.dispose();
    super.dispose();
  }

  void _clear() {
    _controller.clear();
    widget.onChanged?.call('');
    widget.onCleared?.call();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: widget.onChanged,
      onSubmitted: widget.onSubmitted,
      textInputAction: TextInputAction.search,
      style: AppTextStyles.body,
      decoration: InputDecoration(
        hintText: widget.hint,
        hintMaxLines: 1,
        prefixIcon: const Icon(Icons.search, size: AppSize.iconMd),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: context.l10n.commonClear,
                icon: const Icon(Icons.close, size: AppSize.iconMd),
                onPressed: _clear,
              ),
      ),
    );
  }
}

/// Dropdown of the design system: same label-above pattern as [AppTextField].
class AppDropdownField<T> extends StatelessWidget {
  const AppDropdownField({
    super.key,
    required this.items,
    required this.onChanged,
    this.label,
    this.hint,
    this.initialValue,
    this.validator,
    this.helperText,
    this.enabled = true,
  });

  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;
  final String? label;
  final String? hint;
  final T? initialValue;
  final FormFieldValidator<T>? validator;
  final String? helperText;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final field = DropdownButtonFormField<T>(
      initialValue: initialValue,
      items: items,
      isExpanded: true,
      onChanged: enabled ? onChanged : null,
      validator: validator,
      style: AppTextStyles.body,
      dropdownColor: AppColors.surface,
      borderRadius: AppRadius.mdAll,
      icon: const Icon(Icons.keyboard_arrow_down_rounded),
      errorBuilder: (context, message) =>
          _FieldMessage(message: message, isError: true),
      decoration: InputDecoration(
        hintText: hint,
        filled: true,
        fillColor: enabled ? AppColors.surface : AppColors.bgSubtle,
        helper: helperText == null
            ? null
            : _FieldMessage(message: helperText!, isError: false),
      ),
    );
    return _LabeledField(label: label, enabled: enabled, child: field);
  }
}

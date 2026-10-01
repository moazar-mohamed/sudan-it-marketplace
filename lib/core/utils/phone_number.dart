import '../constants/phone_countries.dart';

/// A phone number split into its country and its national number: the digits
/// after the dialling code, without the local trunk 0 (`0912 345 678` in
/// Sudan is national number `912345678`).
class PhoneNumber {
  const PhoneNumber(this.country, this.national);

  final PhoneCountry country;

  /// Digits only.
  final String national;

  bool get isEmpty => national.isEmpty;

  /// The number as it is saved: `+`, the dialling code and the national
  /// number with no spaces (`+249912345678`), or '' when there is none.
  String get e164 => national.isEmpty ? '' : '${country.plusCode}$national';

  bool get hasValidLength =>
      national.length >= country.minLength &&
      national.length <= country.maxLength;

  /// The national number as typed by the user: digits kept, anything else
  /// dropped, and the trunk 0 removed where the country dials without it.
  static String cleanNational(String typed, PhoneCountry country) {
    final digits = typed.replaceAll(RegExp(r'[^0-9]'), '');
    return country.keepsLeadingZero
        ? digits
        : digits.replaceFirst(RegExp(r'^0+'), '');
  }

  /// Reads a saved or pasted number back into a country and national number.
  ///
  /// `+249...` or `00249...` is split on its dialling code. A number saved
  /// before the country code was asked for (`0912345678`, `249912345678`) is
  /// taken as a [fallback] (Sudan) number.
  static PhoneNumber parse(
    String? raw, {
    PhoneCountry fallback = PhoneCountries.sudan,
  }) {
    final text = (raw ?? '').trim();
    final digits = text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return PhoneNumber(fallback, '');

    final international = text.startsWith('+')
        ? digits
        : digits.startsWith('00')
            ? digits.substring(2)
            : null;
    if (international != null) {
      final split = splitInternational(international);
      if (split != null) return split;
      return PhoneNumber(fallback, cleanNational(international, fallback));
    }

    final code = fallback.dialCode;
    if (digits.startsWith(code) &&
        digits.length - code.length >= fallback.minLength &&
        digits.length - code.length <= fallback.maxLength) {
      return PhoneNumber(fallback, digits.substring(code.length));
    }
    return PhoneNumber(fallback, cleanNational(digits, fallback));
  }

  /// Splits international digits (no `+`) on the longest dialling code that
  /// matches, or null when none does.
  static PhoneNumber? splitInternational(String digits) {
    for (var length = 4; length >= 1; length--) {
      if (digits.length <= length) continue;
      final country = byDialCode(digits.substring(0, length));
      if (country != null) {
        return PhoneNumber(
          country,
          cleanNational(digits.substring(length), country),
        );
      }
    }
    return null;
  }

  /// The country that owns [dialCode]; for a shared code, the main one.
  static PhoneCountry? byDialCode(String dialCode) {
    PhoneCountry? shared;
    for (final country in PhoneCountries.all) {
      if (country.dialCode != dialCode) continue;
      if (!country.sharesCode) return country;
      shared ??= country;
    }
    return shared;
  }
}

/// A saved number shown to people: `+249 912345678`. A number saved before
/// the country code was asked for is shown as it was typed.
String displayPhone(String? raw) {
  final text = raw?.trim() ?? '';
  if (!text.startsWith('+')) return text;
  final number = PhoneNumber.parse(text);
  if (number.isEmpty) return text;
  return '${number.country.plusCode} ${number.national}';
}

/// Keeps a left-to-right value (a phone number, `+249`) in one piece and in
/// its own order when it sits inside Arabic text.
String keepLeftToRight(String text) =>
    '${String.fromCharCode(0x2066)}$text${String.fromCharCode(0x2069)}';

/// The forms of a saved number people search with: as saved, and the local
/// way it is dialled inside its country (`0912345678`).
List<String> phoneSearchForms(String? raw) {
  final text = raw?.trim() ?? '';
  if (text.isEmpty) return const [];
  final number = PhoneNumber.parse(text);
  if (number.isEmpty) return [text];
  final local = number.country.keepsLeadingZero
      ? number.national
      : '0${number.national}';
  return [text, number.e164, local];
}

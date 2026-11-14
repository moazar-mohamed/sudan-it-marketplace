/// A dollar amount or a dollar rate as the company typed it: thousands
/// separators and at most two decimals, none when it is whole (250, 12.5,
/// 3,250.75).
String formatUsdAmount(double value) {
  final fixed = value.toStringAsFixed(2);
  final dot = fixed.indexOf('.');
  final whole = fixed.substring(0, dot).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );
  final decimals = fixed.substring(dot + 1).replaceFirst(RegExp(r'0+$'), '');
  return decimals.isEmpty ? whole : '$whole.$decimals';
}

/// [value] as text for an input field: no separators, no needless decimals.
String usdAmountInputText(double value) =>
    formatUsdAmount(value).replaceAll(',', '');

/// Normalizes text so Arabic and English search queries match more
/// forgivingly: strips Arabic diacritics/tatweel and unifies common
/// alef/yeh/teh-marbuta letter variants, then lowercases (a no-op on
/// Arabic script, but needed for English/Latin text).
String normalizeSearchText(String value) {
  final withoutDiacritics = value.replaceAll(
    RegExp(r'[ؐ-ًؚ-ٰٟۖ-ۭـ]'),
    '',
  );
  final unified = withoutDiacritics
      .replaceAll(RegExp(r'[آأإٱ]'), 'ا') // أ إ آ ٱ -> ا
      .replaceAll('ى', 'ي') // ى -> ي
      .replaceAll('ة', 'ه'); // ة -> ه
  return unified.trim().toLowerCase();
}

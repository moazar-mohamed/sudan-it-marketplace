/// [text] cut down to at most [max] in length, as the security rules measure
/// it: `size()` there and `String.length` here both count UTF-16 code units,
/// so a text this returns always fits a rule that says `size() <= max`.
///
/// Never cuts a character in half: when the cut would fall between the two
/// halves of a character stored as a pair (an emoji, for instance), the whole
/// character is left out.
String clipToLength(String text, int max) {
  if (text.length <= max) {
    return text;
  }
  if (max <= 0) {
    return '';
  }
  final last = text.codeUnitAt(max - 1);
  final splitsPair = last >= 0xD800 && last <= 0xDBFF;
  return text.substring(0, splitsPair ? max - 1 : max);
}

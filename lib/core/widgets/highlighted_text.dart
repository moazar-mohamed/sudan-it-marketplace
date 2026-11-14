import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../utils/search_ranking.dart';

/// [text] with the words that match [query] marked, the way search results
/// show why they were found. Without a query it is a plain [Text].
class HighlightedText extends StatelessWidget {
  const HighlightedText(
    this.text, {
    super.key,
    required this.query,
    this.style,
    this.maxLines,
    this.overflow,
  });

  final String text;
  final String? query;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;

  static final _word = RegExp(r'[\p{L}\p{N}]+', unicode: true);

  @override
  Widget build(BuildContext context) {
    final tokens = searchQueryTokens(query ?? '');
    if (tokens.isEmpty) {
      return Text(text, style: style, maxLines: maxLines, overflow: overflow);
    }
    final colors = context.colors;
    final hit = TextStyle(
      color: colors.textBrand,
      backgroundColor: colors.brandPrimarySubtle,
      fontWeight: FontWeight.w700,
    );
    final spans = <TextSpan>[];
    var last = 0;
    for (final match in _word.allMatches(text)) {
      if (!searchWordHit(match[0]!, tokens)) continue;
      if (match.start > last) {
        spans.add(TextSpan(text: text.substring(last, match.start)));
      }
      spans.add(TextSpan(text: match[0], style: hit));
      last = match.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return Text.rich(
      TextSpan(style: style, children: spans),
      maxLines: maxLines,
      overflow: overflow,
    );
  }
}

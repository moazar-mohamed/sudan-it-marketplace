import 'arabic_text.dart';

/// One piece of searchable text and how much a hit in it is worth. A hit in a
/// name (weight 3) outranks a hit in a description (weight 1).
class SearchField {
  const SearchField(this.text, {this.weight = 1});

  final String text;
  final int weight;
}

/// Filters [items] to those matching [query] and puts the best matches first.
///
/// - Every word of the query must match somewhere in the item's fields, in any
///   order, so "dell laptop" finds "Laptop Dell".
/// - A word matches a whole word, the start or the inside of a word, and (for
///   longer words) a word with one or two typos.
/// - Arabic is normalized (diacritics, alef/yeh/teh-marbuta variants, "ال"),
///   and common Arabic/English pairs count as the same word, so "لابتوب" finds
///   "Laptop".
/// - An empty query keeps every item in its original order.
List<T> searchRanked<T>(
  Iterable<T> items,
  String query,
  List<SearchField> Function(T item) fieldsOf,
) {
  final list = items.toList();
  final tokens = _tokens(query);
  if (tokens.isEmpty) return list;

  final wholeQuery = tokens.join(' ');
  final scored = <({T item, int index, int score})>[];
  for (var i = 0; i < list.length; i++) {
    final score = _score(tokens, wholeQuery, fieldsOf(list[i]));
    if (score > 0) scored.add((item: list[i], index: i, score: score));
  }
  scored.sort((a, b) {
    final byScore = b.score.compareTo(a.score);
    return byScore != 0 ? byScore : a.index.compareTo(b.index);
  });
  return [for (final entry in scored) entry.item];
}

/// Whether [query] matches the given fields at all.
bool searchMatches(String query, List<SearchField> fields) {
  final tokens = _tokens(query);
  return tokens.isEmpty || _score(tokens, tokens.join(' '), fields) > 0;
}

// ── scoring ────────────────────────────────────────────────────────────────

const _exact = 10;
const _prefix = 7;
const _inside = 4;
const _typo = 2;

int _score(List<String> queryTokens, String wholeQuery, List<SearchField> fields) {
  final indexed = [
    for (final field in fields)
      if (field.text.trim().isNotEmpty)
        (
          words: _tokens(field.text),
          tokens: _withJoined(_tokens(field.text)),
          weight: field.weight,
        ),
  ];
  var total = 0;
  for (final queryToken in queryTokens) {
    var best = 0;
    for (final field in indexed) {
      for (final token in field.tokens) {
        final hit = _tokenScore(queryToken, token);
        if (hit > 0 && hit * field.weight > best) best = hit * field.weight;
      }
    }
    if (best == 0) return 0; // every word must match somewhere
    total += best;
  }
  // The words together, in order, in the best field: a clear favourite.
  for (final field in indexed) {
    final joined = field.words.join(' ');
    if (joined == wholeQuery) {
      total += 20 * field.weight;
    } else if (joined.startsWith(wholeQuery)) {
      total += 8 * field.weight;
    } else if (queryTokens.length > 1 && joined.contains(wholeQuery)) {
      total += 4 * field.weight;
    }
  }
  return total;
}

/// The words also count as one run, so "tplink" finds "TP-Link" and
/// "wifirouter" finds "Wi-Fi Router".
List<String> _withJoined(List<String> tokens) =>
    tokens.length > 1 ? [...tokens, tokens.join()] : tokens;

int _tokenScore(String query, String token) {
  if (token == query) return _exact;
  if (token.startsWith(query)) return _prefix;
  if (query.length >= 3 && token.contains(query)) return _inside;
  if (query.length >= 4) {
    final allowed = query.length >= 7 ? 2 : 1;
    // Whole word, or just as much of the word as was typed so far.
    final head = token.length > query.length
        ? token.substring(0, query.length)
        : token;
    if (_withinEdits(query, token, allowed) ||
        _withinEdits(query, head, allowed)) {
      return _typo;
    }
  }
  return 0;
}

/// Whether [a] and [b] are at most [max] single-letter edits apart (insert,
/// delete, replace, or swap two neighbours).
bool _withinEdits(String a, String b, int max) {
  if ((a.length - b.length).abs() > max) return false;
  var previous = List<int>.generate(b.length + 1, (j) => j);
  List<int>? beforePrevious;
  for (var i = 1; i <= a.length; i++) {
    final current = List<int>.filled(b.length + 1, 0)..[0] = i;
    for (var j = 1; j <= b.length; j++) {
      final cost = a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1;
      var value = [
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      ].reduce((x, y) => x < y ? x : y);
      if (beforePrevious != null &&
          i > 1 &&
          j > 1 &&
          a.codeUnitAt(i - 1) == b.codeUnitAt(j - 2) &&
          a.codeUnitAt(i - 2) == b.codeUnitAt(j - 1)) {
        final swap = beforePrevious[j - 2] + 1;
        if (swap < value) value = swap;
      }
      current[j] = value;
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length] <= max;
}

// ── normalization and synonyms ─────────────────────────────────────────────

final _punctuation = RegExp(r'[^\p{L}\p{N}\s]', unicode: true);
final _spaces = RegExp(r'\s+');

/// Words of [value] in a form both the query and the data share. Results are
/// remembered because the same product names are searched on every keystroke.
List<String> _tokens(String value) {
  final cached = _tokenCache[value];
  if (cached != null) return cached;
  final tokens = _computeTokens(value);
  if (_tokenCache.length >= 4000) _tokenCache.clear();
  return _tokenCache[value] = tokens;
}

final _tokenCache = <String, List<String>>{};

List<String> _computeTokens(String value) {
  var text = normalizeSearchText(value).replaceAll(_punctuation, ' ');
  text = text.replaceAll(_spaces, ' ').trim();
  if (text.isEmpty) return const [];
  // Articles go first so "الطابعة" becomes the same word as "طابعة".
  text = [for (final word in text.split(' ')) _stripArticle(word)].join(' ');
  for (final rule in _synonymRules) {
    text = text.replaceAllMapped(rule.pattern, (_) => rule.canonical);
  }
  return [
    for (final word in text.split(' '))
      if (word.isNotEmpty) word,
  ];
}

/// "اللابتوب" -> "لابتوب": the Arabic definite article carries no meaning for
/// search. Only stripped from longer words so short words stay intact.
String _stripArticle(String word) =>
    word.length >= 5 && word.startsWith('ال') ? word.substring(2) : word;

class _SynonymRule {
  _SynonymRule(this.canonical, this.pattern);

  final String canonical;
  final RegExp pattern;
}

/// Words and phrases that mean the same thing in a shop for ICT equipment,
/// in Arabic and English. The first entry of each group is what they all
/// become. Written as people type them; normalized when the table is built.
const _synonymGroups = <List<String>>[
  ['laptop', 'لابتوب', 'لاب توب', 'حاسوب محمول', 'كمبيوتر محمول', 'notebook'],
  ['computer', 'كمبيوتر', 'حاسوب', 'حاسب', 'pc', 'desktop', 'ديسكتوب'],
  ['router', 'راوتر', 'روتر', 'جهاز توجيه', 'موجه'],
  ['switch', 'سويتش', 'سويتشات', 'محول شبكة', 'موزع شبكة'],
  ['wifi', 'واي فاي', 'وايفاي', 'wi fi', 'wireless', 'لاسلكي'],
  ['accesspoint', 'اكسس بوينت', 'نقطة وصول', 'access point'],
  ['cable', 'كيبل', 'كابل', 'سلك', 'كوابل', 'كيبلات'],
  ['cctv', 'كاميرا مراقبه', 'كاميرات مراقبه', 'مراقبه', 'surveillance'],
  ['camera', 'كاميرا', 'كاميرات'],
  ['printer', 'طابعه', 'طابعات', 'برنتر'],
  ['scanner', 'ماسح ضوئي', 'سكانر', 'اسكنر'],
  ['server', 'سيرفر', 'خادم', 'سيرفرات', 'خوادم'],
  ['ups', 'يو بي اس', 'مزود طاقه', 'طاقه احتياطيه'],
  ['harddisk', 'هارد', 'قرص صلب', 'هاردسك', 'hard disk', 'hdd'],
  ['ssd', 'اس اس دي'],
  ['ram', 'رام', 'ذاكره'],
  ['monitor', 'شاشه', 'شاشات', 'مونيتور', 'display'],
  ['mouse', 'ماوس', 'فاره'],
  ['keyboard', 'كيبورد', 'لوحه مفاتيح'],
  ['phone', 'موبايل', 'هاتف', 'جوال', 'تلفون', 'smartphone', 'سمارت فون'],
  ['tablet', 'تابلت', 'لوحي'],
  ['firewall', 'فايروول', 'جدار حمايه', 'جدار ناري'],
  ['antivirus', 'مضاد فيروسات', 'انتي فايروس', 'برنامج حمايه'],
  ['software', 'برنامج', 'برمجيات', 'سوفتوير'],
  ['installation', 'تركيب', 'تثبيت', 'install', 'setup', 'تنصيب'],
  ['maintenance', 'صيانه', 'maintain', 'repair', 'اصلاح'],
  ['network', 'شبكه', 'شبكات', 'networking'],
  ['projector', 'بروجكتر', 'جهاز عرض'],
  ['headset', 'سماعه', 'سماعات', 'headphones'],
  ['charger', 'شاحن', 'شواحن', 'adapter'],
  ['battery', 'بطاريه', 'بطاريات'],
];

final List<_SynonymRule> _synonymRules = _buildSynonymRules();

List<_SynonymRule> _buildSynonymRules() {
  final rules = <_SynonymRule>[];
  for (final group in _synonymGroups) {
    final canonical = normalizeSearchText(group.first);
    for (final variant in group) {
      final normalized = normalizeSearchText(variant)
          .replaceAll(_punctuation, ' ')
          .replaceAll(_spaces, ' ')
          .trim();
      if (normalized.isEmpty || normalized == canonical) continue;
      rules.add(
        _SynonymRule(
          canonical,
          // Whole words only, so "ups" never rewrites the inside of "groups".
          RegExp(
            '(?<![\\p{L}\\p{N}])${RegExp.escape(normalized)}(?![\\p{L}\\p{N}])',
            unicode: true,
          ),
        ),
      );
    }
  }
  // Longest phrases first: "كاميرا مراقبه" must win over "كاميرا".
  rules.sort((a, b) => b.pattern.pattern.length.compareTo(a.pattern.pattern.length));
  return rules;
}

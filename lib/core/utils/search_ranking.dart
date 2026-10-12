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
/// - Among equally good matches, the item with the higher [tieBreak] comes
///   first (for example the ones that are in stock), then the original order.
List<T> searchRanked<T>(
  Iterable<T> items,
  String query,
  List<SearchField> Function(T item) fieldsOf, {
  int Function(T item)? tieBreak,
}) {
  final list = items.toList();
  final tokens = _tokens(query);
  if (tokens.isEmpty) return list;

  final wholeQuery = tokens.join(' ');
  final scored = <({T item, int index, int score, int tie})>[];
  for (var i = 0; i < list.length; i++) {
    final score = _score(tokens, wholeQuery, fieldsOf(list[i]));
    if (score > 0) {
      scored.add((
        item: list[i],
        index: i,
        score: score,
        tie: tieBreak?.call(list[i]) ?? 0,
      ));
    }
  }
  scored.sort((a, b) {
    final byScore = b.score.compareTo(a.score);
    if (byScore != 0) return byScore;
    final byTie = b.tie.compareTo(a.tie);
    return byTie != 0 ? byTie : a.index.compareTo(b.index);
  });
  return [for (final entry in scored) entry.item];
}

/// Whether [query] matches the given fields at all.
bool searchMatches(String query, List<SearchField> fields) {
  final tokens = _tokens(query);
  return tokens.isEmpty || _score(tokens, tokens.join(' '), fields) > 0;
}

/// The query as the matcher sees it (normalized words, synonyms applied), to
/// pass to [searchWordHit] for every word of a displayed text.
List<String> searchQueryTokens(String query) => _tokens(query);

/// Whether one displayed [word] is one the query matched, by the same rules
/// as [searchRanked] (so "لابتوب" highlights "Laptop").
bool searchWordHit(String word, List<String> queryTokens) {
  final wordTokens = _tokens(word);
  for (final query in queryTokens) {
    for (final token in wordTokens) {
      if (_tokenScore(query, token) > 0) return true;
    }
  }
  return false;
}

/// "Did you mean ...": a corrected form of [query] built from the words of
/// [vocabulary] (the names people can find), or null when every word of the
/// query is already a word of it, or when no word is close enough to guess.
///
/// Only words that match nothing in the vocabulary are changed, to the closest
/// word within a couple of letters, so a correct query is never rewritten.
String? suggestCorrection(String query, Iterable<String> vocabulary) {
  final tokens = _tokens(query);
  if (tokens.isEmpty) return null;
  final words = <String>{};
  for (final text in vocabulary) {
    words.addAll(_tokens(text));
  }
  if (words.isEmpty) return null;

  var changed = false;
  final corrected = <String>[];
  for (final token in tokens) {
    // Known as it is, or the start or inside of a longer word.
    final known = words.any(
      (word) =>
          word == token ||
          word.startsWith(token) ||
          (token.length >= 3 && word.contains(token)),
    );
    if (known || token.length < 3) {
      corrected.add(token);
      continue;
    }
    // More forgiving than the search itself (which a longer word needs
    // seven letters for two typos): this only runs when nothing was found.
    final allowed = token.length >= 5 ? 2 : 1;
    String? best;
    var bestDistance = allowed + 1;
    for (final word in words) {
      if ((word.length - token.length).abs() > allowed) continue;
      for (var max = 1; max <= allowed && max < bestDistance; max++) {
        if (_withinEdits(token, word, max)) {
          best = word;
          bestDistance = max;
          break;
        }
      }
    }
    if (best == null) {
      corrected.add(token);
    } else {
      corrected.add(best);
      changed = true;
    }
  }
  return changed ? corrected.join(' ') : null;
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
  ['internet', 'انترنت', 'الانترنت'],
  ['fiber', 'فايبر', 'الياف', 'fibre', 'فيبر'],
  ['modem', 'مودم'],
  ['repeater', 'مقوي', 'مقوي شبكه', 'مكرر', 'extender', 'ريبيتر'],
  ['antenna', 'انتينا', 'هوائي', 'اريال'],
  ['intercom', 'انتركم', 'جرس مرئي'],
  ['alarm', 'انذار', 'جهاز انذار'],
  ['accesscontrol', 'تحكم دخول', 'بصمه', 'جهاز بصمه', 'attendance', 'حضور وانصراف'],
  ['solar', 'طاقه شمسيه', 'سولار', 'الواح شمسيه'],
  ['inverter', 'انفرتر', 'محول طاقه'],
  ['generator', 'مولد', 'مولد كهرباء', 'جنريتور'],
  ['stabilizer', 'استابلايزر', 'منظم جهد', 'ستابلايزر', 'avr'],
  ['rack', 'راك', 'خزانه شبكه'],
  ['patchpanel', 'باتش بانل', 'patch panel'],
  ['connector', 'كونكتر', 'موصل', 'rj45', 'rj 45'],
  ['flashdisk', 'فلاش', 'فلاش ديسك', 'فلاشه', 'usb flash', 'ذاكره فلاش'],
  ['memorycard', 'كارت ذاكره', 'ميموري كارد', 'sd card'],
  ['powerbank', 'باور بانك', 'شاحن متنقل', 'بنك طاقه'],
  ['hp', 'اتش بي', 'هيولت باكارد'],
  ['dell', 'ديل'],
  ['lenovo', 'لينوفو', 'لينوفا'],
  ['asus', 'اسوس', 'ايسوس'],
  ['acer', 'ايسر', 'اسر'],
  ['samsung', 'سامسونج', 'سامسونغ'],
  ['huawei', 'هواوي', 'هواوى'],
  ['tplink', 'تي بي لينك', 'tp link', 'tp-link'],
  ['dlink', 'دي لينك', 'd link', 'd-link'],
  ['cisco', 'سيسكو'],
  ['mikrotik', 'ميكروتك', 'ميكروتيك'],
  ['ubiquiti', 'يوبيكويتي', 'ubnt'],
  ['hikvision', 'هيكفيجن', 'هيك فيجن', 'هايك فيجن'],
  ['dahua', 'داهوا', 'داها'],
  ['canon', 'كانون', 'كانن'],
  ['epson', 'ابسون', 'ايبسون'],
  ['brother', 'برذر', 'براذر'],
  ['apc', 'ايه بي سي'],
  ['kaspersky', 'كاسبرسكي'],
  ['windows', 'ويندوز'],
  ['office', 'اوفيس', 'مايكروسوفت اوفيس'],
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

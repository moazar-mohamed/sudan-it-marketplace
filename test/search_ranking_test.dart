import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/utils/search_ranking.dart';

class _Item {
  const _Item(this.name, {this.category = '', this.description = ''});

  final String name;
  final String category;
  final String description;
}

List<SearchField> _fields(_Item item) => [
      SearchField(item.name, weight: 3),
      SearchField(item.category, weight: 2),
      SearchField(item.description),
    ];

List<String> _names(Iterable<_Item> items, String query) =>
    searchRanked(items, query, _fields).map((item) => item.name).toList();

void main() {
  const dell = _Item('Dell Laptop', category: 'Laptops');
  const hp = _Item('HP Laptop 15', category: 'Laptops');
  const router = _Item('TP-Link Router', category: 'Networking');
  const cable = _Item(
    'Cat6 UTP Cable Box',
    category: 'Networking',
    description: 'For laptop docking and router uplinks',
  );
  const camera = _Item('Hikvision 4MP IP Dome Camera', category: 'Security');
  const printer = _Item('HP LaserJet Printer', category: 'Printers');
  const all = [dell, hp, router, cable, camera, printer];

  group('words', () {
    test('an empty query keeps everything in its original order', () {
      expect(_names(all, ''), all.map((i) => i.name).toList());
      expect(_names(all, '   '), all.map((i) => i.name).toList());
    });

    test('every word must match, in any order', () {
      expect(_names(all, 'laptop dell'), ['Dell Laptop']);
      expect(_names(all, 'dell hp'), isEmpty);
    });

    test('a word can be a start or the inside of a word', () {
      expect(_names(all, 'route').first, 'TP-Link Router');
      // "uplinks" in the cable's description contains it too, but ranks lower.
      expect(_names(all, 'link'), ['TP-Link Router', 'Cat6 UTP Cable Box']);
    });

    test('punctuation and case do not matter', () {
      expect(_names(all, 'TP LINK').first, 'TP-Link Router');
      // Written as one word it still finds TP-Link; "uplinks" is one typo away.
      expect(_names(all, 'tplink').first, 'TP-Link Router');
      expect(_names(all, 'wifi router'), isEmpty);
    });

    test('words are matched in every field, not only the name', () {
      // Only the cable has "docking" (in its description).
      expect(_names(all, 'docking'), ['Cat6 UTP Cable Box']);
      // "security" is only a category.
      expect(_names(all, 'security'), ['Hikvision 4MP IP Dome Camera']);
    });
  });

  group('ranking', () {
    test('a name hit outranks a description hit', () {
      final ranked = _names(all, 'router');
      expect(ranked.first, 'TP-Link Router');
      expect(ranked, contains('Cat6 UTP Cable Box'));
    });

    test('an exact word outranks a partial one', () {
      const items = [
        _Item('Laptops bag'),
        _Item('Laptop'),
      ];
      expect(_names(items, 'laptop').first, 'Laptop');
    });

    test('the whole phrase in order beats the words apart', () {
      const items = [
        _Item('Laptop Dell'),
        _Item('Dell Laptop'),
      ];
      expect(_names(items, 'dell laptop'), ['Dell Laptop', 'Laptop Dell']);
    });

    test('equal scores keep the original order', () {
      expect(_names([hp, dell], 'laptop'), ['HP Laptop 15', 'Dell Laptop']);
    });
  });

  group('typos', () {
    test('one wrong, missing, extra or swapped letter still matches', () {
      expect(_names(all, 'laptob'), contains('Dell Laptop'));
      expect(_names(all, 'lptop'), contains('Dell Laptop'));
      expect(_names(all, 'laptopp'), contains('Dell Laptop'));
      expect(_names(all, 'lapotp'), contains('Dell Laptop'));
    });

    test('short words are not guessed at', () {
      expect(_names(all, 'hq'), isEmpty);
    });

    test('unrelated words do not match', () {
      expect(_names(all, 'refrigerator'), isEmpty);
    });
  });

  group('Arabic', () {
    test('diacritics, alef and teh marbuta variants are ignored', () {
      const items = [_Item('طابعة ليزر')];
      expect(_names(items, 'طابعه'), ['طابعة ليزر']);
      expect(_names(items, 'طَابِعَة'), ['طابعة ليزر']);
      const alef = [_Item('أجهزة حاسوب')];
      expect(_names(alef, 'اجهزه'), ['أجهزة حاسوب']);
    });

    test('the definite article is ignored on either side', () {
      const items = [_Item('الطابعة الملونة')];
      expect(_names(items, 'طابعة'), ['الطابعة الملونة']);
      const plain = [_Item('طابعة ملونة')];
      expect(_names(plain, 'الطابعة'), ['طابعة ملونة']);
    });

    test('Arabic and English spellings of a product find each other', () {
      expect(_names(all, 'لابتوب'), containsAll(['Dell Laptop', 'HP Laptop 15']));
      expect(_names(all, 'لاب توب'), contains('Dell Laptop'));
      expect(_names(all, 'راوتر'), contains('TP-Link Router'));
      expect(_names(all, 'طابعة'), ['HP LaserJet Printer']);
      expect(_names(all, 'كيبل'), ['Cat6 UTP Cable Box']);
      expect(_names(all, 'كاميرا'), ['Hikvision 4MP IP Dome Camera']);

      const arabic = [
        _Item('لابتوب ديل'),
        _Item('راوتر واي فاي'),
        _Item('كاميرا مراقبة خارجية'),
      ];
      expect(_names(arabic, 'laptop'), ['لابتوب ديل']);
      expect(_names(arabic, 'router'), ['راوتر واي فاي']);
      expect(_names(arabic, 'wifi'), ['راوتر واي فاي']);
      expect(_names(arabic, 'wi-fi'), ['راوتر واي فاي']);
      expect(_names(arabic, 'cctv'), ['كاميرا مراقبة خارجية']);
    });

    test('a synonym never rewrites the inside of another word', () {
      // "ups" is a product word, but must not turn "groups" into anything.
      const items = [_Item('Study groups planner'), _Item('APC UPS 1500VA')];
      // "groups" contains the letters, but only as a weak inside match.
      expect(_names(items, 'ups'), ['APC UPS 1500VA', 'Study groups planner']);
      expect(_names(items, 'يو بي اس'), ['APC UPS 1500VA', 'Study groups planner']);
    });
  });

  test('searchMatches answers yes or no for one item', () {
    final fields = _fields(dell);
    expect(searchMatches('لابتوب', fields), isTrue);
    expect(searchMatches('printer', fields), isFalse);
    expect(searchMatches('', fields), isTrue);
  });
}

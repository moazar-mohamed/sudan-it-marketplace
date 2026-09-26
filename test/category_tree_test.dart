import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/data/models/category_model.dart';
import 'package:sudan_it_marketplace/features/categories/domain/category_tree.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';

final _created = DateTime(2026);

/// A category; the ancestor chain is worked out from [parentId] by [tree].
Category _c(
  String id,
  String? parentId, {
  String ar = '',
  String? en,
  int? sortOrder,
  bool isActive = true,
  bool deletionPending = false,
}) => Category(
  id: id,
  name: en ?? id,
  nameAr: ar,
  nameEn: en ?? id,
  description: '',
  iconName: '',
  isActive: isActive,
  createdAt: _created,
  sortOrder: sortOrder,
  parentId: parentId,
  deletionPending: deletionPending,
);

void main() {
  group('CategoryTree', () {
    final sample = [
      _c('net', null, ar: 'شبكات', en: 'Networking', sortOrder: 0),
      _c('rou', 'net', ar: 'راوترات', en: 'Routers', sortOrder: 0),
      _c('wifi', 'rou', ar: 'واي فاي', en: 'Wi-Fi 6'),
      _c('swi', 'net', ar: 'سويتشات', en: 'Switches', sortOrder: 1),
      _c('lap', null, ar: 'لابتوبات', en: 'Laptops', sortOrder: 1),
    ];

    test('lists children in the order Platform Admin set, at every level', () {
      final tree = CategoryTree(sample);
      expect(tree.childrenOf(null).map((c) => c.id), ['net', 'lap']);
      expect(tree.childrenOf('net').map((c) => c.id), ['rou', 'swi']);
      expect(tree.childrenOf('rou').map((c) => c.id), ['wifi']);
      expect(tree.childrenOf('wifi'), isEmpty);
      expect(tree.hasChildren('net'), isTrue);
      expect(tree.hasChildren('wifi'), isFalse);
    });

    test('gives the full path in the language shown', () {
      final tree = CategoryTree(sample);
      expect(tree.pathOf('wifi').map((c) => c.id), ['net', 'rou', 'wifi']);
      expect(tree.pathLabel('wifi', 'en'), 'Networking › Routers › Wi-Fi 6');
      expect(tree.pathLabel('wifi', 'ar'), 'شبكات › راوترات › واي فاي');
      expect(tree.pathLabel('lap', 'en', separator: ' / '), 'Laptops');
    });

    test('falls back to the single name when a language has none', () {
      final tree = CategoryTree([
        _c('a', null, en: 'Old'),
        Category(
          id: 'b',
          name: 'Only English',
          description: '',
          iconName: '',
          isActive: true,
          createdAt: _created,

          parentId: 'a',
        ),
      ]);
      expect(tree.pathLabel('b', 'ar'), 'Old › Only English');
    });

    test('the subtree of a category is itself and everything below it', () {
      final tree = CategoryTree(sample);
      expect(tree.subtreeIds('net'), {'net', 'rou', 'wifi', 'swi'});
      expect(tree.subtreeIds('rou'), {'rou', 'wifi'});
      expect(tree.subtreeIds('wifi'), {'wifi'});
      expect(tree.subtreeIds('ghost'), isEmpty);
    });

    test('has no fixed depth: 3,000 nested levels work', () {
      final chain = [
        for (var i = 0; i < 3000; i++) _c('c$i', i == 0 ? null : 'c${i - 1}'),
      ];
      final tree = CategoryTree(chain);
      expect(tree.subtreeIds('c0'), hasLength(3000));
      expect(tree.pathOf('c2999'), hasLength(3000));
      expect(tree.isEffectivelyActive('c2999'), isTrue);
    });

    test('never loops on a cycle in bad data', () {
      final tree = CategoryTree([_c('a', 'b'), _c('b', 'a'), _c('c', 'c')]);
      expect(tree.pathOf('a').map((c) => c.id).toSet(), {'a', 'b'});
      expect(tree.subtreeIds('a'), {'a', 'b'});
      expect(tree.pathOf('c').map((c) => c.id), ['c']);
    });

    test('a category whose parent is missing is treated as top-level', () {
      final tree = CategoryTree([_c('x', 'gone')]);
      expect(tree.childrenOf(null).map((c) => c.id), ['x']);
    });

    test('a category is only shown when it and every ancestor is active', () {
      final tree = CategoryTree([
        _c('r', null),
        _c('a', 'r', isActive: false),
        _c('b', 'a'),
        _c('c', 'r'),
        _c('d', 'r', deletionPending: true),
      ]);
      expect(tree.isEffectivelyActive('r'), isTrue);
      expect(tree.isEffectivelyActive('a'), isFalse);
      expect(tree.isEffectivelyActive('b'), isFalse); // hidden with its parent
      expect(tree.isEffectivelyActive('d'), isFalse); // being deleted
      expect(tree.isEffectivelyActive('ghost'), isFalse);
      expect(tree.activeChildrenOf('r').map((c) => c.id), ['c']);
    });

    test(
      'searches Arabic and English names, forgivingly, among shown ones',
      () {
        final tree = CategoryTree([
          ...sample,
          _c('hid', 'net', en: 'Hidden Wi-Fi', isActive: false),
        ]);
        expect(tree.search('wi-fi').map((c) => c.id), ['wifi']);
        expect(tree.search('واي فاي').map((c) => c.id), ['wifi']);
        expect(tree.search('راوتر').map((c) => c.id), ['rou']);
        expect(tree.search('لابتوب').map((c) => c.id), ['lap']);
        expect(tree.search('   '), isEmpty);
        expect(tree.search('zzz'), isEmpty);
      },
    );
  });

  group('the category data model', () {
    test('reads the tree fields', () {
      final category = CategoryModel.fromMap('k', {
        'name': 'Routers',
        'nameAr': 'راوترات',
        'nameEn': 'Routers',
        'parentId': 'net',
        'ancestorIds': ['top', 'net'],
        'deletionPending': true,
        'isActive': true,
      });
      expect(category.parentId, 'net');
      expect(category.ancestorIds, ['top', 'net']);
      expect(category.deletionPending, isTrue);
    });

    test('an older category has no parent or marker', () {
      final category = CategoryModel.fromMap('k', {
        'name': 'Old',
        'isActive': true,
      });
      expect(category.parentId, isNull);
      expect(category.ancestorIds, isEmpty);
      expect(category.deletionPending, isFalse);
    });

    test('bad values are ignored, never a crash', () {
      final category = CategoryModel.fromMap('k', {
        'name': 'x',
        'parentId': '',
        'ancestorIds': ['a', 5, null, 'b'],
        'deletionPending': 'yes',
      });
      expect(category.parentId, isNull);
      expect(category.ancestorIds, ['a', 'b']);
      expect(category.deletionPending, isFalse);
    });
  });

  group('changes made by Platform Admin appear without any app update', () {
    test(
      'a new category shows up in the tree as soon as it is saved',
      () async {
        final feed = StreamController<List<Category>>();
        final container = ProviderContainer(
          overrides: [allCategoriesProvider.overrideWith((ref) => feed.stream)],
        );
        addTearDown(() async {
          container.dispose();
          await feed.close();
        });
        final seen = <List<String>>[];
        container.listen(
          categoryTreeProvider,
          (_, tree) => seen.add(tree.all.map((c) => c.id).toList()),
          fireImmediately: true,
        );
        expect(seen.last, isEmpty);

        feed.add([_c('p1', null)]);
        await pumpEventQueue();
        expect(seen.last, ['p1']);

        // Platform Admin adds a sub-category and another top-level category
        feed.add([_c('p1', null), _c('p2', 'p1'), _c('s1', null)]);
        await pumpEventQueue();
        expect(seen.last.toSet(), {'p1', 'p2', 's1'});
        expect(
          container
              .read(categoryTreeProvider)
              .childrenOf('p1')
              .map((c) => c.id),
          ['p2'],
        );

        // ... and later deactivates the parent: the sub-category goes with it
        feed.add([
          _c('p1', null, isActive: false),
          _c('p2', 'p1'),
          _c('s1', null),
        ]);
        await pumpEventQueue();
        final tree = container.read(categoryTreeProvider);
        expect(tree.isEffectivelyActive('p2'), isFalse);
        expect(tree.activeChildrenOf(null).map((c) => c.id), ['s1']);
      },
    );

    test('paths are worded in the language the app shows', () async {
      final container = ProviderContainer(
        overrides: [
          allCategoriesProvider.overrideWith(
            (ref) => Stream.value([
              _c('a', null, ar: 'شبكات', en: 'Networking'),
              _c('b', 'a', ar: 'راوترات', en: 'Routers'),
            ]),
          ),
        ],
      );
      addTearDown(container.dispose);
      container.listen(allCategoriesProvider, (_, _) {});
      await pumpEventQueue();
      expect(
        container.read(categoryPathNamesProvider)['b'],
        'Networking › Routers',
      );
    });
  });
}

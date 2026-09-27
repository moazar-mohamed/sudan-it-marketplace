import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/locale_controller.dart';
import '../../../core/utils/arabic_text.dart';

/// Where the customer's recent searches are kept on this device.
const recentSearchesKey = 'recent_searches';

/// How many recent searches are remembered.
const maxRecentSearches = 8;

/// The customer's recent searches on this device, newest first.
final recentSearchesProvider =
    NotifierProvider<RecentSearchesController, List<String>>(
  RecentSearchesController.new,
);

class RecentSearchesController extends Notifier<List<String>> {
  @override
  List<String> build() =>
      ref.read(sharedPreferencesProvider)?.getStringList(recentSearchesKey) ??
      const [];

  /// Puts [query] first; the same search typed differently is kept once.
  Future<void> add(String query) async {
    final text = query.trim();
    if (text.isEmpty) return;
    final key = normalizeSearchText(text);
    await _save([
      text,
      for (final old in state)
        if (normalizeSearchText(old) != key) old,
    ].take(maxRecentSearches).toList());
  }

  Future<void> remove(String query) =>
      _save([for (final old in state) if (old != query) old]);

  Future<void> clear() => _save(const []);

  Future<void> _save(List<String> searches) async {
    state = searches;
    await ref
        .read(sharedPreferencesProvider)
        ?.setStringList(recentSearchesKey, searches);
  }
}

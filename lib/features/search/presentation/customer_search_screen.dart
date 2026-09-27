import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../categories/domain/entities/category.dart';
import '../../categories/presentation/category_providers.dart';
import '../../companies/presentation/company_details_screen.dart';
import '../../companies/presentation/widgets/company_card.dart';
import '../../customer_dashboard/presentation/widgets/category_grid.dart';
import '../../products/presentation/product_details_screen.dart';
import '../../products/presentation/widgets/product_card.dart';
import '../../services/presentation/service_details_screen.dart';
import '../../services/presentation/widgets/service_card.dart';
import 'marketplace_search.dart';
import 'recent_searches.dart';

/// The customer's search: recent searches and categories while empty,
/// suggestions while typing, and after a search every matching product,
/// service and company, grouped, with the matched words marked.
class CustomerSearchScreen extends ConsumerStatefulWidget {
  const CustomerSearchScreen({super.key});

  @override
  ConsumerState<CustomerSearchScreen> createState() =>
      _CustomerSearchScreenState();
}

enum _Scope { all, products, services, companies }

/// How many of each kind "All" shows before "See all".
const _previewCount = 3;

class _CustomerSearchScreenState extends ConsumerState<CustomerSearchScreen> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  /// What is in the box now; drives the suggestions.
  String _text = '';

  /// The search whose results are shown; null while typing.
  MarketplaceQuery? _submitted;
  _Scope _scope = _Scope.all;

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _setBox(String text) {
    _controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  void _onChanged(String value) => setState(() {
        _text = value;
        _submitted = null;
        _scope = _Scope.all;
      });

  void _search(String value) {
    final text = value.trim();
    if (text.isEmpty) return;
    _setBox(text);
    setState(() {
      _text = text;
      _submitted = (text: text, categoryId: null);
      _scope = _Scope.all;
    });
    ref.read(recentSearchesProvider.notifier).add(text);
    _focus.unfocus();
  }

  void _openCategory(Category category) {
    final name = category.nameFor(Localizations.localeOf(context).languageCode);
    _setBox(name);
    setState(() {
      _text = name;
      _submitted = (text: name, categoryId: category.id);
      _scope = _Scope.all;
    });
    _focus.unfocus();
  }

  void _clear() {
    _controller.clear();
    setState(() {
      _text = '';
      _submitted = null;
    });
    _focus.requestFocus();
  }

  /// A suggestion goes straight to what it names; what was typed is kept as
  /// a recent search.
  void _openSuggestion(Widget screen) {
    ref.read(recentSearchesProvider.notifier).add(_text);
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final submitted = _submitted;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsetsDirectional.only(end: AppSpacing.s12),
          child: TextField(
            key: const ValueKey('customer-search-field'),
            controller: _controller,
            focusNode: _focus,
            autofocus: true,
            textInputAction: TextInputAction.search,
            onChanged: _onChanged,
            onSubmitted: _search,
            style: AppTextStyles.body.copyWith(color: colors.textPrimary),
            decoration: InputDecoration(
              hintText: l10n.searchHint,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                vertical: AppSpacing.s8,
              ),
              prefixIcon: Icon(Icons.search_rounded, color: colors.iconMuted),
              suffixIcon: _text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: l10n.commonClear,
                      icon: Icon(Icons.close_rounded, color: colors.iconMuted),
                      onPressed: _clear,
                    ),
            ),
          ),
        ),
      ),
      body: _text.trim().isEmpty
          ? _IdleView(onSearch: _search, onCategory: _openCategory)
          : submitted == null
              ? _SuggestionsView(
                  text: _text,
                  onSearch: () => _search(_text),
                  onOpen: _openSuggestion,
                  onCategory: _openCategory,
                )
              : _ResultsView(
                  query: submitted,
                  scope: _scope,
                  onScope: (scope) => setState(() => _scope = scope),
                  onCategory: _openCategory,
                ),
    );
  }
}

/// Before anything is typed: recent searches, then the top categories.
class _IdleView extends ConsumerWidget {
  const _IdleView({required this.onSearch, required this.onCategory});

  final ValueChanged<String> onSearch;
  final ValueChanged<Category> onCategory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final recent = ref.watch(recentSearchesProvider);
    final history = ref.read(recentSearchesProvider.notifier);

    return AppCenteredList(
      children: [
        if (recent.isNotEmpty) ...[
          SectionHeader(
            title: l10n.searchRecent,
            actionLabel: l10n.commonClear,
            onAction: history.clear,
          ),
          for (final query in recent)
            ListTile(
              key: ValueKey('recent-search-$query'),
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                Icons.history_rounded,
                color: context.colors.iconMuted,
              ),
              title: Text(query, maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: IconButton(
                tooltip: l10n.searchRemoveRecent,
                icon: Icon(
                  Icons.close_rounded,
                  size: AppSize.iconMd,
                  color: context.colors.iconMuted,
                ),
                onPressed: () => history.remove(query),
              ),
              onTap: () => onSearch(query),
            ),
          const SizedBox(height: AppSpacing.s16),
        ],
        _CategoryChips(onCategory: onCategory),
      ],
    );
  }
}

/// The top-level categories as chips, to search by browsing.
class _CategoryChips extends ConsumerWidget {
  const _CategoryChips({required this.onCategory});

  final ValueChanged<Category> onCategory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(categoryTreeProvider).activeChildrenOf(null);
    if (categories.isEmpty) return const SizedBox.shrink();
    final language = Localizations.localeOf(context).languageCode;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.searchBrowseCategories, style: AppTextStyles.h3),
        const SizedBox(height: AppSpacing.s8),
        Wrap(
          spacing: AppSpacing.s8,
          runSpacing: AppSpacing.s8,
          children: [
            for (final category in categories)
              ActionChip(
                key: ValueKey('search-category-${category.id}'),
                avatar: Icon(
                  categoryIconFor(category),
                  size: AppSize.iconSm,
                  color: context.colors.iconBrand,
                ),
                label: Text(category.nameFor(language)),
                onPressed: () => onCategory(category),
              ),
          ],
        ),
      ],
    );
  }
}

/// While typing: "Search for …" and the best matching names, each opening
/// its product, service or company directly.
class _SuggestionsView extends ConsumerWidget {
  const _SuggestionsView({
    required this.text,
    required this.onSearch,
    required this.onOpen,
    required this.onCategory,
  });

  final String text;
  final VoidCallback onSearch;
  final ValueChanged<Widget> onOpen;
  final ValueChanged<Category> onCategory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.colors;
    final results =
        ref.watch(marketplaceSearchProvider((text: text, categoryId: null)));
    if (results.isEmpty && !results.servicesLoading) {
      return _NoResults(query: text.trim(), onCategory: onCategory);
    }

    Widget suggestion({
      required Key key,
      required IconData icon,
      required String name,
      required String type,
      required Widget screen,
    }) =>
        ListTile(
          key: key,
          leading: Icon(icon, color: colors.iconMuted),
          title: HighlightedText(
            name,
            query: text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: Text(
            type,
            style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
          ),
          onTap: () => onOpen(screen),
        );

    return ListView(
      children: [
        ListTile(
          key: const ValueKey('search-submit'),
          leading: Icon(Icons.search_rounded, color: colors.iconBrand),
          title: Text(
            l10n.searchFor(text.trim()),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong.copyWith(color: colors.textBrand),
          ),
          onTap: onSearch,
        ),
        const Divider(height: 1),
        for (final product in results.products.take(3))
          suggestion(
            key: ValueKey('suggestion-product-${product.id}'),
            icon: Icons.inventory_2_outlined,
            name: product.name,
            type: l10n.searchTypeProduct,
            screen: ProductDetailsScreen(product: product),
          ),
        for (final service in results.services.take(2))
          suggestion(
            key: ValueKey('suggestion-service-${service.id}'),
            icon: Icons.miscellaneous_services_outlined,
            name: service.name,
            type: l10n.searchTypeService,
            screen: ServiceDetailsScreen(service: service),
          ),
        for (final company in results.companies.take(2))
          suggestion(
            key: ValueKey('suggestion-company-${company.id}'),
            icon: Icons.business_outlined,
            name: company.name,
            type: l10n.searchTypeCompany,
            screen: CompanyDetailsScreen(company: company),
          ),
      ],
    );
  }
}

/// After a search: the counts per kind as filters, then the results.
class _ResultsView extends ConsumerWidget {
  const _ResultsView({
    required this.query,
    required this.scope,
    required this.onScope,
    required this.onCategory,
  });

  final MarketplaceQuery query;
  final _Scope scope;
  final ValueChanged<_Scope> onScope;
  final ValueChanged<Category> onCategory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final results = ref.watch(marketplaceSearchProvider(query));
    final categoryNames = ref.watch(categoryNamesProvider);
    if (results.isEmpty && !results.servicesLoading) {
      return _NoResults(query: query.text, onCategory: onCategory);
    }
    // A category is browsed, not matched word by word: nothing to mark.
    final highlight = query.categoryId == null ? query.text : null;

    Widget product(int i) => ProductCard(
          product: results.products[i],
          categoryName: categoryNames[results.products[i].categoryId],
          highlight: highlight,
        );
    Widget service(int i) => ServiceCard(
          service: results.services[i],
          categoryName: categoryNames[results.services[i].categoryId],
          highlight: highlight,
        );
    Widget company(int i) =>
        CompanyCard(company: results.companies[i], highlight: highlight);

    List<Widget> group({
      required String title,
      required int count,
      required _Scope target,
      required Widget Function(int) item,
    }) {
      if (count == 0) return const [];
      final shown = scope == _Scope.all && count > _previewCount
          ? _previewCount
          : count;
      return [
        if (scope == _Scope.all) ...[
          SectionHeader(
            title: title,
            actionLabel: count > _previewCount ? l10n.searchSeeAll(count) : null,
            onAction: () => onScope(target),
          ),
          const SizedBox(height: AppSpacing.s8),
        ],
        for (var i = 0; i < shown; i++) ...[
          item(i),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: AppSpacing.s8),
      ];
    }

    return AppCenteredList(
      topPadding: AppSpacing.s12,
      children: [
        AppFilterChips(
          key: const ValueKey('search-scopes'),
          labels: [
            l10n.searchAll(results.total),
            l10n.searchProducts(results.products.length),
            l10n.searchServices(results.services.length),
            l10n.searchCompanies(results.companies.length),
          ],
          selectedIndex: scope.index,
          onChanged: (index) => onScope(_Scope.values[index]),
        ),
        const SizedBox(height: AppSpacing.s16),
        if (scope == _Scope.all || scope == _Scope.products)
          ...group(
            title: l10n.navProducts,
            count: results.products.length,
            target: _Scope.products,
            item: product,
          ),
        if (scope == _Scope.all || scope == _Scope.services)
          ...group(
            title: l10n.navServices,
            count: results.services.length,
            target: _Scope.services,
            item: service,
          ),
        if (scope == _Scope.all || scope == _Scope.companies)
          ...group(
            title: l10n.navCompanies,
            count: results.companies.length,
            target: _Scope.companies,
            item: company,
          ),
        if (results.servicesLoading) const AppSkeletonList(count: 1),
        if (scope != _Scope.all &&
            switch (scope) {
              _Scope.products => results.products.isEmpty,
              _Scope.services => results.services.isEmpty,
              _Scope.companies => results.companies.isEmpty,
              _Scope.all => false,
            })
          AppEmptyState(
            icon: Icons.search_off_rounded,
            message: l10n.searchNoResults(query.text),
          ),
      ],
    );
  }
}

/// Nothing found: say so, suggest what to try, and offer the categories.
class _NoResults extends StatelessWidget {
  const _NoResults({required this.query, required this.onCategory});

  final String query;
  final ValueChanged<Category> onCategory;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppCenteredList(
      children: [
        AppEmptyState(
          key: const ValueKey('search-no-results'),
          icon: Icons.search_off_rounded,
          title: l10n.searchNoResults(query),
          message: l10n.searchNoResultsTip,
        ),
        const SizedBox(height: AppSpacing.s16),
        _CategoryChips(onCategory: onCategory),
      ],
    );
  }
}

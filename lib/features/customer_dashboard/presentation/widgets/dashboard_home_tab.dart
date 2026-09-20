import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/arabic_text.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../companies/presentation/widgets/company_card.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/widgets/product_card.dart';
import '../../../../core/localization/l10n_extension.dart';

class DashboardHomeTab extends ConsumerStatefulWidget {
  const DashboardHomeTab({super.key, this.onSelectTab});

  final ValueChanged<int>? onSelectTab;

  @override
  ConsumerState<DashboardHomeTab> createState() => _DashboardHomeTabState();
}

enum _HomeTab { products, companies }

class _DashboardHomeTabState extends ConsumerState<DashboardHomeTab> {
  final TextEditingController _searchController = TextEditingController();

  // Owned by this tab so it never binds to the ambient PrimaryScrollController,
  // which the sibling IndexedStack tabs also attach to.
  final ScrollController _scrollController = ScrollController();
  String _searchQuery = '';
  _HomeTab _selectedTab = _HomeTab.products;

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    setState(() {
      _searchQuery = normalizeSearchText(value);
    });
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _searchQuery = '';
    });
  }

  void _selectTab(_HomeTab tab) {
    if (_selectedTab == tab) return;
    setState(() => _selectedTab = tab);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final horizontalPadding = screenWidth < 360 ? 12.0 : 16.0;
    final mockCompanies = ref.watch(marketplaceCompaniesProvider);
    final mockProducts = ref.watch(marketplaceProductsProvider);

    final filteredCompanies = _searchQuery.isEmpty
        ? mockCompanies
        : mockCompanies
            .where((company) =>
                normalizeSearchText(company.name).contains(_searchQuery))
            .toList();

    final filteredProducts = _searchQuery.isEmpty
        ? mockProducts
        : mockProducts
            .where((product) =>
                normalizeSearchText(product.name).contains(_searchQuery))
            .toList();

    final isProductsTab = _selectedTab == _HomeTab.products;

    return ListView(
      controller: _scrollController,
      primary: false,
      padding: EdgeInsets.fromLTRB(
        horizontalPadding,
        16,
        horizontalPadding,
        16,
      ),
      children: [
        TextField(
          controller: _searchController,
          onChanged: _onSearchChanged,
          decoration: InputDecoration(
            hintText: isProductsTab
                ? context.l10n.homeSearchProducts
                : context.l10n.homeSearchCompanies,
            hintMaxLines: 1,
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: _clearSearch,
                  )
                : null,
            filled: true,
            fillColor: colorScheme.surface,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _HomeTabButton(
                label: context.l10n.navProducts,
                selected: isProductsTab,
                onTap: () => _selectTab(_HomeTab.products),
              ),
            ),
            Expanded(
              child: _HomeTabButton(
                label: context.l10n.navCompanies,
                selected: !isProductsTab,
                onTap: () => _selectTab(_HomeTab.companies),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (isProductsTab)
          if (filteredProducts.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  context.l10n.homeNoProducts,
                  style: textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ),
            )
          else
            Column(
              children: [
                for (int i = 0; i < filteredProducts.length; i++) ...[
                  ProductCard(product: filteredProducts[i]),
                  if (i < filteredProducts.length - 1)
                    const SizedBox(height: 10),
                ],
              ],
            )
        else if (filteredCompanies.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                context.l10n.homeNoCompanies,
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
          )
        else
          Column(
            children: [
              for (int i = 0; i < filteredCompanies.length; i++) ...[
                CompanyCard(company: filteredCompanies[i]),
                if (i < filteredCompanies.length - 1)
                  const SizedBox(height: 10),
              ],
            ],
          ),
      ],
    );
  }
}

class _HomeTabButton extends StatelessWidget {
  const _HomeTabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: textTheme.titleSmall?.copyWith(
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? colorScheme.primary
                    : colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            height: 3,
            decoration: BoxDecoration(
              color: selected ? colorScheme.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ],
      ),
    );
  }
}
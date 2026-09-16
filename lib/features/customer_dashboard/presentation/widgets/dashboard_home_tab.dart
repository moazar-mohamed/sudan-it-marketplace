import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../companies/presentation/companies_providers.dart';
import '../../../companies/presentation/widgets/company_card.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/widgets/product_card.dart';

class DashboardHomeTab extends ConsumerStatefulWidget {
  const DashboardHomeTab({super.key, this.onSelectTab});

  final ValueChanged<int>? onSelectTab;

  @override
  ConsumerState<DashboardHomeTab> createState() => _DashboardHomeTabState();
}

class _DashboardHomeTabState extends ConsumerState<DashboardHomeTab> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    setState(() {
      _searchQuery = value.trim().toLowerCase();
    });
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _searchQuery = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final mockCompanies = ref.watch(marketplaceCompaniesProvider);
    final mockProducts = ref.watch(marketplaceProductsProvider);

    final filteredCompanies = _searchQuery.isEmpty
        ? mockCompanies
        : mockCompanies
            .where((company) =>
                company.name.toLowerCase().contains(_searchQuery))
            .toList();

    final filteredProducts = _searchQuery.isEmpty
        ? mockProducts
        : mockProducts
            .where((product) =>
                product.name.toLowerCase().contains(_searchQuery))
            .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        TextField(
          controller: _searchController,
          onChanged: _onSearchChanged,
          decoration: InputDecoration(
            hintText: 'Search companies or products...',
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
        const SizedBox(height: 24),
        Text(
          'Companies',
          style: textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: 12),
        if (filteredCompanies.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                'No companies found',
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
        const SizedBox(height: 28),
        Text(
          'Products',
          style: textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: 12),
        if (filteredProducts.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                'No products found',
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
          ),
      ],
    );
  }
}
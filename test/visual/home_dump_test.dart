// Dev tool, not a regression test: renders the customer home (all three tabs)
// at phone width, in Arabic and English, and writes PNGs so the layout can be
// compared with the design without a device. Run with:
//   FLUTTER_ROOT=/path/to/flutter VISUAL_OUT=out flutter test test/visual/home_dump_test.dart
// Output goes to the folder in the VISUAL_OUT environment variable.
@Tags(['visual'])
library;

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/core/widgets/app_widgets.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/dashboard_home_tab.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_pricing.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Future<void> _loadFonts() async {
  final cairo = FontLoader('Cairo');
  for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    cairo.addFont(rootBundle.load('assets/fonts/Cairo-$weight.ttf'));
  }
  await cairo.load();
  final root = Platform.environment['FLUTTER_ROOT'] ?? 'C:/flutter';
  final icons = FontLoader('MaterialIcons')
    ..addFont(
      File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf')
          .readAsBytes()
          .then((b) => ByteData.view(Uint8List.fromList(b).buffer)),
    );
  await icons.load();
}

final _key = GlobalKey();
final _now = DateTime.now();

Category _cat(String id, String en, String ar, String icon) => Category(
  id: id,
  name: en,
  nameEn: en,
  nameAr: ar,
  description: '',
  iconName: icon,
  isActive: true,
  createdAt: DateTime(2026),
);

final _categories = [
  _cat('net', 'Networks', 'الشبكات', 'network'),
  _cat('sec', 'Security & cameras', 'الأمن والكاميرات', 'security'),
  _cat('lap', 'Laptops', 'اللابتوبات', 'laptop'),
  _cat('prn', 'Printers', 'الطابعات', 'printer'),
  _cat('off', 'Office devices', 'أجهزة مكتبية', 'computer'),
  _cat('srv', 'Servers', 'السيرفرات', 'server'),
  _cat('mnt', 'Maintenance', 'الصيانة', 'tools'),
];

const _companies = [
  Company(id: 'c1', name: 'Blue Nile Systems', rating: 4.8, reviewCount: 31),
  Company(id: 'c2', name: 'Nile Tech Solutions', rating: 4.6, reviewCount: 128),
  Company(
    id: 'c3',
    name: 'Blue Nile Technologies',
    rating: 4.6,
    reviewCount: 21,
  ),
  Company(id: 'c4', name: 'Sahara Networks', rating: 4.2, reviewCount: 54),
];

final _products = [
  Product(
    id: 'p1',
    name: 'TP-Link Router AX3000',
    price: 250000,
    offerPrice: 199000,
    offerEndsAt: _now.add(const Duration(hours: 18, minutes: 42, seconds: 5)),
    offerBadge: OfferBadge.limited,
    companyId: 'c2',
    companyName: 'Nile Tech Solutions',
    categoryId: 'net',
    isInstallationAvailable: true,
    createdAt: _now.subtract(const Duration(days: 20)),
  ),
  Product(
    id: 'p2',
    name: 'Dell Latitude 5440 Laptop',
    price: 385000,
    offerPrice: 349000,
    offerBadge: OfferBadge.special,
    companyId: 'c1',
    companyName: 'Blue Nile Systems',
    categoryId: 'lap',
    createdAt: _now.subtract(const Duration(days: 30)),
  ),
  Product(
    id: 'p3',
    name: 'Cisco Switch 24-Port',
    price: 410000,
    offerPrice: 369000,
    offerBadge: OfferBadge.limited,
    companyId: 'c4',
    companyName: 'Sahara Networks',
    categoryId: 'net',
    createdAt: _now.subtract(const Duration(days: 40)),
  ),
  Product(
    id: 'p4',
    name: 'Hikvision CCTV Kit (4 cameras)',
    companyId: 'c3',
    companyName: 'Blue Nile Technologies',
    categoryId: 'sec',
    isDeliveryAvailable: false,
    isInstallationAvailable: true,
  ),
  Product(
    id: 'p5',
    name: 'Hikvision 4MP IP Network Dome Camera',
    price: 95000,
    companyId: 'c3',
    companyName: 'Blue Nile Technologies',
    categoryId: 'sec',
    createdAt: _now.subtract(const Duration(days: 3)),
  ),
  Product(
    id: 'p6',
    name: 'Dell PowerEdge T140 Tower Server',
    price: 2400000,
    companyId: 'c1',
    companyName: 'Blue Nile Systems',
    categoryId: 'srv',
    createdAt: _now.subtract(const Duration(days: 60)),
  ),
  Product(
    id: 'p7',
    name: 'Ubiquiti UniFi U6 Pro Access Point',
    price: 310000,
    companyId: 'c4',
    companyName: 'Sahara Networks',
    categoryId: 'net',
    isInstallationAvailable: true,
    createdAt: _now.subtract(const Duration(days: 1)),
  ),
];

CatalogService _service(String id, String name, String catId, String about) =>
    CatalogService(
      id: id,
      categoryId: catId,
      name: name,
      description: about,
      isActive: true,
      createdAt: DateTime(2026),
    );

final _services = [
  _service(
    's1',
    'Network Installation',
    'net',
    'Structured cabling and Wi-Fi setup for offices.',
  ),
  _service(
    's2',
    'CCTV Installation',
    'sec',
    'Camera installation, DVR setup and remote viewing.',
  ),
  _service('s3', 'Laptop maintenance', 'mnt', ''),
];

final _links = [
  CompanyServiceModel(
    id: 'c2_s1',
    companyId: 'c2',
    serviceId: 's1',
    isActive: true,
    createdAt: DateTime(2026),
    price: 50000,
    offerPrice: 40000,
    offerBadge: OfferBadge.discount,
  ),
  CompanyServiceModel(
    id: 'c3_s2',
    companyId: 'c3',
    serviceId: 's2',
    isActive: true,
    createdAt: DateTime(2026),
  ),
  CompanyServiceModel(
    id: 'c1_s3',
    companyId: 'c1',
    serviceId: 's3',
    isActive: true,
    createdAt: DateTime(2026),
  ),
];

const _ratings = {
  'product_p1': RatingStats(sum: 45, count: 10),
  'product_p2': RatingStats(sum: 23, count: 5),
  'product_p3': RatingStats(sum: 13, count: 3),
};

Future<void> _shot(
  WidgetTester tester,
  String name, {
  required Locale locale,
  required String tab,
  double width = 390,
  double height = 4200,
  ThemeData? theme,
}) async {
  tester.view.physicalSize = Size(width, height);
  tester.view.devicePixelRatio = 1;
  await tester.pumpWidget(const SizedBox());
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        firestoreProductsStreamProvider.overrideWith(
          (ref) => Stream.value(_products),
        ),
        firestoreCompaniesStreamProvider.overrideWith(
          (ref) => Stream.value(_companies),
        ),
        activeServicesProvider(null)
            .overrideWith((ref) => Stream.value(_services)),
        allCategoriesProvider.overrideWith((ref) => Stream.value(_categories)),
        allActiveCompanyServicesProvider.overrideWith(
          (ref) => Stream.value(_links),
        ),
        ratingsProvider.overrideWith((ref) => Stream.value(_ratings)),
      ],
      child: RepaintBoundary(
        key: _key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: theme ?? AppTheme.light,
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            // The real dashboard's app bar, which the redesign leaves as it is.
            appBar: AppBar(
              title: const Row(
                children: [
                  AppLogoMark(),
                  SizedBox(width: 10),
                  Flexible(child: Text('سوق السودان لتقنية المعلومات')),
                ],
              ),
              actions: const [
                Icon(Icons.settings_outlined),
                SizedBox(width: 8),
                Icon(Icons.notifications_outlined),
                SizedBox(width: 8),
              ],
            ),
            body: const DashboardHomeTab(),
          ),
        ),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 300));
  if (tab != 'products') {
    final label = switch ((tab, locale.languageCode)) {
      ('services', 'ar') => 'الخدمات',
      ('services', _) => 'Services',
      ('companies', 'ar') => 'الشركات',
      _ => 'Companies',
    };
    await tester.tap(find.text(label).first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
  }
  await tester.runAsync(() async {
    final boundary =
        _key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 2);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    final out = Platform.environment['VISUAL_OUT'] ?? 'build/visual';
    await Directory(out).create(recursive: true);
    await File('$out/$name-${locale.languageCode}-${width.toInt()}.png')
        .writeAsBytes(data!.buffer.asUint8List());
  });
}

void main() {
  // Skipped in a normal test run: it only writes pictures when asked to.
  final skip = Platform.environment['VISUAL_OUT'] == null
      ? 'dev tool: set VISUAL_OUT to a folder to write the pictures'
      : null;
  setUpAll(() async {
    if (skip == null) await _loadFonts();
  });

  testWidgets('home: products tab', skip: skip != null, (tester) async {
    addTearDown(tester.view.reset);
    await _shot(
      tester,
      'home-products',
      locale: const Locale('ar'),
      tab: 'products',
    );
    await _shot(
      tester,
      'home-products',
      locale: const Locale('en'),
      tab: 'products',
    );
  });

  testWidgets('home: services tab', skip: skip != null, (tester) async {
    addTearDown(tester.view.reset);
    await _shot(
      tester,
      'home-services',
      locale: const Locale('ar'),
      tab: 'services',
      height: 2600,
    );
  });

  testWidgets('home: companies tab', skip: skip != null, (tester) async {
    addTearDown(tester.view.reset);
    await _shot(
      tester,
      'home-companies',
      locale: const Locale('ar'),
      tab: 'companies',
      height: 2000,
    );
  });

  testWidgets('home: products tab, dark', skip: skip != null, (tester) async {
    addTearDown(tester.view.reset);
    await _shot(
      tester,
      'home-products-dark',
      locale: const Locale('ar'),
      tab: 'products',
      theme: AppTheme.dark,
    );
  });
}

// Dev tool, not a regression test: renders key screens at several widths in
// English and Arabic and writes PNGs, so the layout can be inspected without a
// device. Run with:  flutter test test/visual/screens_dump_test.dart
// Output goes to the folder in the VISUAL_OUT environment variable.
@Tags(['visual'])
library;

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_colors.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/core/widgets/app_widgets.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_state.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/forgot_password_screen.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/login_screen.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/register_screen.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_grid.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/widgets/company_order_tile.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/widgets/technician_job_tile.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/widgets/company_card.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/checkout_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_pending_verification_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/manual_payment_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/receipt_picker.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/checkout_order_draft.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_receipt.dart';
import '../helpers/receipt_fakes.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/widgets/order_card.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/product_details_screen.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_card.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

class _StubAuth extends AuthController {
  @override
  AuthState build() => const AuthUnauthenticated();
}

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

Widget _frame(Widget home, Locale locale, [List<Override> extra = const []]) {
  return ProviderScope(
    overrides: [
      ...extra,
      authControllerProvider.overrideWith(_StubAuth.new),
      resolvedCompanyProvider.overrideWith((ref, id) => _company),
      firestoreProductsStreamProvider.overrideWith((ref) => Stream.value(const [])),
    ],
    child: RepaintBoundary(
      key: _key,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    ),
  );
}

const _company = Company(
  id: 'c1',
  name: 'Khartoum Tech Solutions',
  rating: 4.6,
  reviewCount: 128,
  city: 'Khartoum',
  address: 'Africa Street, Khartoum',
  pickupAddress: 'Africa Street, Khartoum',
);

const _priced = Product(
  id: 'p1',
  name: 'Dell Latitude 5440 Laptop',
  price: 385000,
  companyId: 'c1',
  companyName: 'Khartoum Tech Solutions',
  description: '14-inch business laptop with 16 GB RAM and a 512 GB SSD.',
  specifications: {'RAM': '16 GB', 'Storage': '512 GB SSD', 'Screen': '14"'},
  isInstallationAvailable: true,
  installationPrice: 20000,
  stockCount: 6,
);
const _unpriced = Product(
  id: 'p2',
  name: 'Custom server rack',
  companyId: 'c1',
  companyName: 'Khartoum Tech Solutions',
);

final _order = OrderEntity(
  id: 'ord123456789',
  customerId: 'u1',
  companyId: 'c1',
  companyName: 'Khartoum Tech Solutions',
  productId: 'p1',
  productName: 'Dell Latitude 5440 Laptop',
  quantity: 1,
  unitPrice: 385000,
  productSubtotal: 385000,
  installationSelected: true,
  installationFee: 20000,
  deliveryFee: 15000,
  totalAmount: 420000,
  deliveryAddress: 'Riyadh district, street 15',
  contactPhone: '+249 912 345 678',
  receiptFileName: 'receipt.jpg',
  orderStatus: OrderStatus.outForDelivery,
  createdAt: DateTime(2026, 9, 23, 14, 5),
);

Widget _gallery() {
  return Scaffold(
    appBar: AppBar(title: const Text('Components')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        AppButton.primary(label: 'Primary', expand: true, onPressed: () {}),
        const SizedBox(height: 8),
        AppButton.primary(label: 'Loading', loading: true, expand: true, onPressed: () {}),
        const SizedBox(height: 8),
        const AppButton.primary(label: 'Disabled', expand: true, onPressed: null),
        const SizedBox(height: 8),
        AppButton.outlined(label: 'Outlined', icon: Icons.add, expand: true, onPressed: () {}),
        const SizedBox(height: 8),
        AppButton.destructiveOutlined(label: 'Cancel request', expand: true, onPressed: () {}),
        const SizedBox(height: 8),
        Row(children: [
          AppButton.secondary(label: 'Secondary', size: AppButtonSize.medium, onPressed: () {}),
          const SizedBox(width: 8),
          AppButton.text(label: 'Text', onPressed: () {}),
          const SizedBox(width: 8),
          AppButton.destructive(label: 'Delete', size: AppButtonSize.small, onPressed: () {}),
        ]),
        const SizedBox(height: 16),
        const AppTextField(label: 'Full name', hint: 'Your name', prefixIcon: Icons.person_outline),
        const SizedBox(height: 12),
        const AppTextField(label: 'Password', password: true, helperText: 'At least 6 characters.'),
        const SizedBox(height: 12),
        Form(
          autovalidateMode: AutovalidateMode.always,
          child: AppTextField(label: 'Email', validator: (_) => 'Email is required.'),
        ),
        const SizedBox(height: 12),
        const AppTextField(label: 'Disabled', enabled: false, initialValue: 'a@b.co'),
        const SizedBox(height: 16),
        const Wrap(spacing: 8, runSpacing: 8, children: [
          StatusChip(label: 'Pending', tone: AppTone.warning),
          StatusChip(label: 'Accepted', tone: AppTone.info),
          StatusChip(label: 'In progress', tone: AppTone.progress),
          StatusChip(label: 'Completed', tone: AppTone.success),
          StatusChip(label: 'Rejected', tone: AppTone.error),
          StatusChip(label: 'Cancelled', tone: AppTone.neutral),
        ]),
        const SizedBox(height: 16),
        const AppBanner(tone: AppTone.warning, title: 'Low stock', message: 'Only 3 units left.'),
        const SizedBox(height: 8),
        const AppBanner(tone: AppTone.error, message: 'Invalid email or password.'),
        const SizedBox(height: 16),
        const AppStepTracker(labels: ['Pending', 'Accepted', 'In progress', 'Completed'], currentIndex: 1),
        const SizedBox(height: 16),
        AppUnderlineTabs(labels: const ['Products', 'Services', 'Companies'], selectedIndex: 0, onChanged: (_) {}),
        const SizedBox(height: 12),
        AppFilterChips(labels: const ['All', 'Pending (2)', 'Done'], selectedIndex: 1, onChanged: (_) {}),
        const SizedBox(height: 16),
        AppQuantityStepper(value: 2, canDecrement: true, canIncrement: true, onDecrement: () {}, onIncrement: () {}),
        const SizedBox(height: 16),
        const ProductCard(product: _priced, categoryName: 'Laptops'),
        const SizedBox(height: 8),
        const ProductCard(product: _unpriced),
        const SizedBox(height: 8),
        const CompanyCard(company: _company),
        const SizedBox(height: 8),
        OrderCard(order: _order),
        const SizedBox(height: 8),
        CompanyOrderTile(order: _order, onTap: () {}),
        const SizedBox(height: 8),
        TechnicianJobTile(order: _order, onTap: () {}),
        const AppEmptyState(icon: Icons.inbox_outlined, title: 'No orders yet', message: 'Your orders appear here.'),
      ],
    ),
  );
}

/// Profile-style form: editable fields next to read-only ones (the email).
Widget _profileFields() => Scaffold(
      appBar: AppBar(title: const Text('Profile fields')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const AppTextField(
            label: 'Full name',
            initialValue: 'Moazer Mohamed',
            prefixIcon: Icons.person_outline,
          ),
          const SizedBox(height: 16),
          const AppTextField(
            label: 'Email',
            initialValue: 'customer@example.test',
            enabled: false,
            prefixIcon: Icons.email_outlined,
            textDirection: TextDirection.ltr,
          ),
          const SizedBox(height: 16),
          const AppTextField(
            label: 'Phone number',
            optional: true,
            initialValue: '+249 91 234 5678',
            prefixIcon: Icons.phone_outlined,
            textDirection: TextDirection.ltr,
          ),
          const SizedBox(height: 16),
          const AppTextField(
            label: 'Phone (read-only)',
            initialValue: '+249 91 234 5678',
            enabled: false,
            prefixIcon: Icons.phone_outlined,
            textDirection: TextDirection.ltr,
          ),
        ],
      ),
    );

Widget _sharedRefactor() {
  final categories = [
    for (final n in ['Laptops', 'Printers', 'Networking', 'Software'])
      Category(
        id: n,
        name: n,
        nameAr: n,
        nameEn: n,
        description: '',
        iconName: '',
        isActive: true,
        createdAt: DateTime(2026),
      ),
  ];
  return Scaffold(
    appBar: AppBar(title: const Text('Shared refactor')),
    bottomNavigationBar: const AppBottomBar(
      child: AppButton(label: 'Bottom bar action', onPressed: null, expand: true),
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        CategoryGrid(categories: categories, selectedId: 'Printers', onSelected: (_) {}),
        const SizedBox(height: 16),
        AppFilterChips(
          labels: const ['All (5)', 'Pending (2)', 'Processing (1)', 'Completed (2)'],
          selectedIndex: 1,
          onChanged: (_) {},
        ),
        const SizedBox(height: 16),
        const Row(children: [AppUnreadDot(), SizedBox(width: 8), Text('unread dot')]),
        const SizedBox(height: 16),
        SizedBox(
          height: 220,
          child: AppTabbedView(
            labels: const ['Products', 'Services'],
            children: const [Center(child: Text('first page')), Center(child: Text('second page'))],
          ),
        ),
        const SizedBox(height: 16),
        const AppSkeletonList(count: 1),
        const AppEmptyState(icon: Icons.inbox_outlined, title: 'No orders yet', message: 'Your orders appear here.'),
      ],
    ),
  );
}

Future<void> _shot(
  WidgetTester tester,
  String name,
  Widget Function() build, {
  required double width,
  required Locale locale,
  double height = 1400,
}) async {
  tester.view.physicalSize = Size(width, height);
  tester.view.devicePixelRatio = 1;
  await tester.pumpWidget(const SizedBox()); // drop the previous ProviderScope
  await tester.pumpWidget(_frame(build(), locale));
  await tester.pump(const Duration(milliseconds: 300));
  await tester.runAsync(() async {
    final boundary =
        _key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 1.5);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    final out = Platform.environment['VISUAL_OUT'] ?? 'build/visual';
    await Directory(out).create(recursive: true);
    await File('$out/$name-${locale.languageCode}-${width.toInt()}.png')
        .writeAsBytes(data!.buffer.asUint8List());
  });
}

/// The payment screen before and after the customer chooses a receipt.
Future<void> _paymentShots(WidgetTester tester, Locale locale) async {
  tester.view.physicalSize = const Size(390, 1500);
  tester.view.devicePixelRatio = 1;
  final receipt = ReceiptImage(
    fileName: 'bankak_screenshot.jpg',
    bytes: jpg(receiptLikeImage(width: 540, height: 1200)),
    width: 540,
    height: 1200,
  );
  const draft = CheckoutOrderDraft(
    orderId: 'o1',
    customerId: 'u1',
    companyId: 'c1',
    companyName: 'Khartoum Tech Solutions',
    productId: 'p1',
    productName: 'Dell Latitude 5440 Laptop',
    quantity: 1,
    unitPrice: 385000,
    productSubtotal: 385000,
    installationSelected: false,
    installationFee: 0,
    deliveryFee: 0,
    totalAmount: 385000,
    deliveryAddress: 'Khartoum',
    contactPhone: '0912345678',
  );
  final picker = FakePicker(file: PickedReceiptFile(name: 'x.png', bytes: receipt.bytes));
  final overrides = <Override>[
    receiptPickerProvider.overrideWithValue(picker.call),
    receiptCompressorProvider.overrideWithValue(FakeCompressor(result: receipt)),
  ];
  await tester.pumpWidget(const SizedBox()); // a fresh ProviderScope (its overrides differ)
  await tester.pumpWidget(_frame(const ManualPaymentScreen(draft: draft), locale, overrides));
  await tester.pumpAndSettle();

  Future<void> capture(String name) async {
    await tester.runAsync(() async {
      final boundary = _key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1.5);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      final out = Platform.environment['VISUAL_OUT'] ?? 'build/visual';
      await Directory(out).create(recursive: true);
      await File('$out/$name-${locale.languageCode}-390.png').writeAsBytes(data!.buffer.asUint8List());
    });
  }

  final scroll = find.byType(Scrollable).first;
  await tester.drag(scroll, const Offset(0, -700));
  await tester.pumpAndSettle();
  await capture('payment-upload');

  final l10n = locale.languageCode == 'ar' ? AppLocalizationsAr() : AppLocalizationsEn();
  await tester.tap(find.textContaining(l10n.paymentTapToUpload));
  await tester.pumpAndSettle();
  await capture('payment-source-sheet');
  await tester.tap(find.text(l10n.imageChooseFromDevice));
  await tester.pumpAndSettle();
  // the harness does not decode images by itself: do it, as a device would
  await tester.runAsync(() async {
    await precacheImage(
      MemoryImage(receipt.bytes),
      tester.element(find.byType(ManualPaymentScreen)),
    );
  });
  await tester.pumpAndSettle();
  await tester.drag(scroll, const Offset(0, -900));
  await tester.pumpAndSettle();
  await capture('payment-receipt-chosen');
}

void main() {
  const en = Locale('en');
  const ar = Locale('ar');

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _loadFonts();
  });

  tearDown(() {
    // Each screenshot resizes the view; a fresh binding state per test.
  });

  testWidgets('screens', skip: Platform.environment['VISUAL_OUT'] == null,
      (tester) async {
    addTearDown(tester.view.reset);
    for (final locale in [en, ar]) {
      await _shot(tester, 'gallery', _gallery, width: 390, height: 2600, locale: locale);
      await _shot(tester, 'login', () => const LoginScreen(), width: 390, height: 844, locale: locale);
      await _shot(tester, 'register', () => const RegisterScreen(), width: 390, height: 900, locale: locale);
      await _shot(tester, 'order-details', () => OrderDetailsScreen(order: _order), width: 390, height: 1500, locale: locale);
      await _shot(tester, 'order-pending', () => OrderPendingVerificationScreen(order: _order), width: 390, height: 1300, locale: locale);
      await _shot(tester, 'product-details', () => const ProductDetailsScreen(product: _priced), width: 390, height: 1200, locale: locale);
      await _shot(tester, 'product-noprice', () => const ProductDetailsScreen(product: _unpriced), width: 390, height: 700, locale: locale);
      await _shot(tester, 'checkout', () => const CheckoutScreen(product: _priced, quantity: 2), width: 390, height: 1700, locale: locale);
      await _shot(tester, 'shared-refactor', _sharedRefactor, width: 390, height: 1100, locale: locale);
      await _shot(tester, 'profile-fields', _profileFields, width: 390, height: 520, locale: locale);
      await _paymentShots(tester, locale);
      await _shot(tester, 'forgot-password', () => const ForgotPasswordScreen(initialEmail: 'customer@example.test'), width: 390, height: 640, locale: locale);
    }
    // Responsive checks on the most layout-sensitive screens.
    for (final width in [375.0, 414.0, 768.0, 1280.0]) {
      await _shot(tester, 'gallery', _gallery, width: width, height: 3400, locale: ar);
      await _shot(tester, 'checkout', () => const CheckoutScreen(product: _priced, quantity: 2), width: width, height: 1700, locale: en);
      await _shot(tester, 'order-details', () => OrderDetailsScreen(order: _order), width: width, height: 1400, locale: en);
      await _shot(tester, 'product-details', () => const ProductDetailsScreen(product: _priced), width: width, height: 1100, locale: en);
      await _shot(tester, 'login', () => const LoginScreen(), width: width, height: 800, locale: en);
    }
  });
}

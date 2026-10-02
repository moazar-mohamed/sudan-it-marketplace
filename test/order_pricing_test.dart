import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/errors/app_exception.dart';
import 'package:sudan_it_marketplace/core/localization/error_messages.dart';
import 'package:sudan_it_marketplace/features/orders/domain/order_pricing.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

void main() {
  const router = Product(
    id: 'p1',
    name: 'Router',
    price: 1500,
    isInstallationAvailable: true,
    installationPrice: 2500,
  );

  bool matches(
    Product product, {
    required double unitPrice,
    bool installationSelected = false,
    double installationFee = 0,
  }) =>
      OrderPricing.matchesProduct(
        product: product,
        unitPrice: unitPrice,
        installationSelected: installationSelected,
        installationFee: installationFee,
      );

  group('an order still priced as the product', () {
    test('the listed price matches', () {
      expect(matches(router, unitPrice: 1500), isTrue);
    });

    test('the listed price with the installation price matches', () {
      expect(
        matches(router, unitPrice: 1500, installationSelected: true, installationFee: 2500),
        isTrue,
      );
    });

    test('a running offer is paid at the offer price', () {
      final offer = Product(
        id: 'p2',
        name: 'Switch',
        price: 1000,
        offerPrice: 800,
        offerEndsAt: DateTime.now().add(const Duration(days: 1)),
      );
      expect(matches(offer, unitPrice: 800), isTrue);
      expect(matches(offer, unitPrice: 1000), isFalse);
    });

    test('an ended offer is paid at the normal price', () {
      final ended = Product(
        id: 'p3',
        name: 'Switch',
        price: 1000,
        offerPrice: 800,
        offerEndsAt: DateTime.now().subtract(const Duration(days: 1)),
      );
      expect(matches(ended, unitPrice: 1000), isTrue);
      expect(matches(ended, unitPrice: 800), isFalse);
    });
  });

  group('a price that changed while the customer was paying', () {
    test('a new product price does not match the old one', () {
      expect(matches(router.copyWithPrice(1700), unitPrice: 1500), isFalse);
    });

    test('a new installation price does not match the old one', () {
      const changed = Product(
        id: 'p1',
        name: 'Router',
        price: 1500,
        isInstallationAvailable: true,
        installationPrice: 3000,
      );
      expect(
        matches(changed, unitPrice: 1500, installationSelected: true, installationFee: 2500),
        isFalse,
      );
    });

    test('installation the product no longer offers does not match', () {
      const withdrawn = Product(id: 'p1', name: 'Router', price: 1500);
      expect(
        matches(withdrawn, unitPrice: 1500, installationSelected: true, installationFee: 2500),
        isFalse,
      );
    });

    test('an installation fee without installation does not match', () {
      expect(matches(router, unitPrice: 1500, installationFee: 2500), isFalse);
    });
  });

  test('a product without a price never matches, not even at 0', () {
    const unpriced = Product(id: 'p4', name: 'Server');
    expect(matches(unpriced, unitPrice: 0), isFalse);
    expect(matches(unpriced, unitPrice: 500), isFalse);
  });

  test('the price-changed error names the product in both languages', () {
    const error = AppException(AppErrorCode.orderPriceChanged, productName: 'Router');
    expect(localizedErrorMessage(AppLocalizationsEn(), error), contains('Router'));
    expect(localizedErrorMessage(AppLocalizationsAr(), error), contains('Router'));
  });
}

extension on Product {
  Product copyWithPrice(double price) => Product(
        id: id,
        name: name,
        price: price,
        isInstallationAvailable: isInstallationAvailable,
        installationPrice: installationPrice,
      );
}

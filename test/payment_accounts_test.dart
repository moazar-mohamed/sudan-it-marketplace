import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/companies/data/models/company_model.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/payment_account.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/checkout_order_draft.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/manual_payment_screen.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _draft = CheckoutOrderDraft(
  orderId: 'o1',
  customerId: 'cust1',
  companyId: 'c1',
  companyName: 'ABC Technology',
  productId: 'p1',
  productName: 'Router',
  quantity: 1,
  unitPrice: 1000,
  productSubtotal: 1000,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: 0,
  totalAmount: 1000,
  deliveryAddress: 'Khartoum',
  contactPhone: '0912345678',
);

Widget _paymentScreen(Company? company) {
  return ProviderScope(
    overrides: [
      resolvedCompanyProvider('c1').overrideWithValue(company),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: [Locale('en'), Locale('ar')],
      locale: Locale('en'),
      home: ManualPaymentScreen(draft: _draft),
    ),
  );
}

void main() {
  group('company payment accounts in Firestore data', () {
    test('a company document without accounts has none', () {
      expect(CompanyModel.fromMap('c1', {'name': 'A'}).paymentAccounts, isEmpty);
    });

    test('accounts are read in order, and unusable entries are skipped', () {
      final company = CompanyModel.fromMap('c1', {
        'name': 'A',
        'paymentAccounts': [
          {
            'bankName': 'بنك الخرطوم',
            'accountName': 'شركة',
            'accountNumber': '1984205',
            'phoneNumber': '0912345678',
          },
          'not a map',
          {'bankName': '', 'accountNumber': '5'},
          {'bankName': 'Faisal', 'accountNumber': '0849201'},
        ],
      });
      expect(company.paymentAccounts.map((a) => a.bankName), [
        'بنك الخرطوم',
        'Faisal',
      ]);
      expect(company.paymentAccounts.last.phoneNumber, '');
    });

    test('an account survives the trip to and from Firestore fields', () {
      const account = PaymentAccount(
        bankName: 'Bank of Khartoum',
        accountName: 'ABC',
        accountNumber: '123',
        phoneNumber: '+249912345678',
      );
      final written = CompanyModel.paymentAccountsToFirestore([account]);
      final read = CompanyModel.fromMap('c1', {'paymentAccounts': written});
      expect(read.paymentAccounts, [account]);
    });

    test('editing the profile fields never rewrites the accounts', () {
      const company = Company(
        id: 'c1',
        name: 'A',
        rating: 0,
        reviewCount: 0,
        paymentAccounts: [
          PaymentAccount(bankName: 'B', accountName: 'A', accountNumber: '1'),
        ],
      );
      expect(
        CompanyModel.toEditableFields(company).containsKey('paymentAccounts'),
        isFalse,
      );
      expect(company.copyWith(name: 'New').paymentAccounts, hasLength(1));
    });
  });

  group('the customer payment screen', () {
    testWidgets("shows the order's company accounts, not fixed platform ones",
        (tester) async {
      await tester.pumpWidget(
        _paymentScreen(
          const Company(
            id: 'c1',
            name: 'ABC Technology',
            rating: 0,
            reviewCount: 0,
            paymentAccounts: [
              PaymentAccount(
                bankName: 'Bank of Khartoum',
                accountName: 'ABC Technology',
                accountNumber: '7700123',
                phoneNumber: '0912345678',
              ),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Bank of Khartoum'), findsOneWidget);
      expect(find.text('7700123'), findsOneWidget);
      expect(find.text('Bank of Khartoum (Bankak)'), findsNothing);
      expect(find.text('1984205'), findsNothing);
    });

    // The screen used to draw an INVENTED "transfer slip" preview naming a
    // beneficiary. Receipts are now the customer's real image (see
    // receipt_upload_test.dart), so the only payee shown is the company's own
    // account, and nothing on the screen can name the marketplace.
    testWidgets('the payee is only ever the own account of the company, never the marketplace',
        (tester) async {
      await tester.pumpWidget(
        _paymentScreen(
          const Company(
            id: 'c1',
            name: 'ABC Technology',
            rating: 0,
            reviewCount: 0,
            paymentAccounts: [
              PaymentAccount(
                bankName: 'Bank of Khartoum',
                accountName: 'ABC Tech Co.',
                accountNumber: '7700123',
              ),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('ABC Tech Co.'), findsOneWidget); // the company's account holder
      expect(find.textContaining('Beneficiary'), findsNothing); // no invented slip
      expect(find.textContaining('Sudan ICT Marketplace'), findsNothing);
    });

    testWidgets('a company without accounts shows a notice', (tester) async {
      await tester.pumpWidget(
        _paymentScreen(
          const Company(id: 'c1', name: 'ABC Technology', rating: 0, reviewCount: 0),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('has not added payment accounts'), findsOneWidget);
      expect(find.text('Bank of Khartoum (Bankak)'), findsNothing);
    });
  });
}

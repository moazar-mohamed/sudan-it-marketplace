import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/errors/app_exception.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/user_profile_repository.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_providers.dart';
import 'package:sudan_it_marketplace/features/chats/data/datasources/chats_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/chats/data/models/chat_models.dart';
import 'package:sudan_it_marketplace/features/chats/data/repositories/chats_repository_impl.dart';
import 'package:sudan_it_marketplace/features/chats/domain/entities/chat_conversation.dart';
import 'package:sudan_it_marketplace/features/chats/domain/entities/chat_message.dart';
import 'package:sudan_it_marketplace/features/chats/domain/repositories/chats_repository.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_screen.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chats_list_screen.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_services/domain/entities/company_service.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/product_details_screen.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/widgets/service_offer_card.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _en = Locale('en');
const _ar = Locale('ar');
final _created = DateTime(2026, 9, 29, 10);

Product _product({String id = 'real1', double? price = 1000, int stock = 4}) =>
    Product(
      id: id,
      name: 'Router',
      price: price,
      stockCount: stock,
      companyId: 'c1',
      companyName: 'Nile Tech',
    );

const _company = Company(
  id: 'c1',
  name: 'Nile Tech',
  rating: 4.5,
  reviewCount: 3,
  status: 'active',
);

ChatConversation _inquiry({String? productId = 'real1'}) => ChatConversation(
      id: productId != null
          ? ChatConversation.productInquiryId('cust1', productId)
          : ChatConversation.serviceInquiryId('cust1', 'c1_svc1'),
      productId: productId,
      companyServiceId: productId == null ? 'c1_svc1' : null,
      customerId: 'cust1',
      companyId: 'c1',
      customerName: 'Amna Ali',
      companyName: 'Nile Tech',
      productName: productId == null ? '' : 'Router',
      serviceName: productId == null ? 'Software Installation' : '',
      createdAt: _created,
    );

/// Records what the Contact button asked for, and serves the conversation it
/// then opens.
class _FakeChats extends Fake implements ChatsRepository {
  _FakeChats({this.failWith});

  final AppException? failWith;
  final opened = <Map<String, String>>[];
  ChatConversation? conversation;

  @override
  Future<String> openProductInquiry({
    required String customerId,
    required String customerName,
    required String companyId,
    required String companyName,
    required String productId,
    required String productName,
  }) async {
    if (failWith != null) throw failWith!;
    opened.add({
      'customerId': customerId,
      'customerName': customerName,
      'companyId': companyId,
      'companyName': companyName,
      'productId': productId,
      'productName': productName,
    });
    conversation = _inquiry(productId: productId);
    return conversation!.id;
  }

  @override
  Future<String> openServiceInquiry({
    required String customerId,
    required String customerName,
    required String companyId,
    required String companyName,
    required String companyServiceId,
    required String serviceName,
  }) async {
    if (failWith != null) throw failWith!;
    opened.add({
      'customerId': customerId,
      'customerName': customerName,
      'companyId': companyId,
      'companyName': companyName,
      'companyServiceId': companyServiceId,
      'serviceName': serviceName,
    });
    conversation = _inquiry(productId: null);
    return conversation!.id;
  }

  @override
  Stream<ChatConversation?> watchConversation(String chatId) =>
      Stream.value(conversation);

  @override
  Stream<List<ChatMessage>> watchMessages(String chatId) =>
      Stream.value(const []);

  @override
  Stream<List<ChatConversation>> watchCustomerConversations(
    String customerId,
  ) =>
      Stream.value([if (conversation != null) conversation!]);

  @override
  Future<void> markRead({
    required String chatId,
    required ChatParticipantRole role,
  }) async {}
}

class _FakeProfiles extends Fake implements UserProfileRepository {
  @override
  Future<UserProfile?> fetchProfile(String userId) async => UserProfile(
        id: userId,
        fullName: 'Amna Ali',
        email: 'amna@example.test',
        role: UserRole.customer,
        createdAt: _created,
        isActive: true,
      );
}

/// Only what the repository hands to Firestore.
class _RecordingRemote extends Fake implements ChatsRemoteDataSource {
  final calls = <Map<String, String>>[];

  @override
  Future<void> openProductInquiry({
    required String customerId,
    required String customerName,
    required String companyId,
    required String companyName,
    required String productId,
    required String productName,
  }) async {
    calls.add({
      'customerName': customerName,
      'companyName': companyName,
      'productId': productId,
    });
  }
}

Widget _app(
  Widget home,
  _FakeChats chats, {
  Locale locale = _en,
  List<Product>? catalogue,
}) {
  return ProviderScope(
    overrides: [
      chatsRepositoryProvider.overrideWithValue(chats),
      currentUserIdProvider.overrideWithValue('cust1'),
      userProfileRepositoryProvider.overrideWithValue(_FakeProfiles()),
      firestoreProductsStreamProvider
          .overrideWith((ref) => Stream.value(catalogue ?? [_product()])),
      resolvedCompanyProvider.overrideWith(
        (ref, companyId) => companyId == 'c1' ? _company : null,
      ),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [_en, _ar],
      home: home,
    ),
  );
}

Finder _button(String label) => find.ancestor(
      of: find.text(label),
      matching: find.byWidgetPredicate(
        (widget) => widget is FilledButton || widget is OutlinedButton,
      ),
    );

void main() {
  group('a question conversation, before ordering', () {
    test('has one fixed id per customer and product or service offer', () {
      expect(
        ChatConversation.productInquiryId('cust1', 'p1'),
        'cust1_product_p1',
      );
      expect(
        ChatConversation.serviceInquiryId('cust1', 'c1_svc1'),
        'cust1_service_c1_svc1',
      );
    });

    test('is told apart from an order or request, and names its subject', () {
      final product = _inquiry();
      expect(product.isInquiry, isTrue);
      expect(product.isOrderChat, isFalse);
      expect(product.subjectLabel, 'Router');

      final service = _inquiry(productId: null);
      expect(service.isInquiry, isTrue);
      expect(service.subjectLabel, 'Software Installation');

      final order = ChatConversation(
        id: 'o1',
        orderId: 'o1',
        customerId: 'cust1',
        companyId: 'c1',
        customerName: 'Amna',
        companyName: 'Nile Tech',
        productName: 'Router',
        createdAt: _created,
      );
      expect(order.isInquiry, isFalse);
      expect(order.subjectLabel, 'Router');
    });

    test('is written with exactly one anchor: the product or the offer', () {
      final product = ChatModels.productInquiryChatCreateMap(
        customerId: 'cust1',
        companyId: 'c1',
        customerName: 'Amna',
        companyName: 'Nile Tech',
        productId: 'p1',
        productName: 'Router',
      );
      expect(product['id'], 'cust1_product_p1');
      expect(product['productId'], 'p1');
      expect(product['productName'], 'Router');
      expect(product['serviceName'], '');
      expect(product['orderId'], isNull);
      expect(product['serviceRequestId'], isNull);
      expect(product.containsKey('companyServiceId'), isFalse);

      final service = ChatModels.serviceInquiryChatCreateMap(
        customerId: 'cust1',
        companyId: 'c1',
        customerName: 'Amna',
        companyName: 'Nile Tech',
        companyServiceId: 'c1_svc1',
        serviceName: 'Software Installation',
      );
      expect(service['id'], 'cust1_service_c1_svc1');
      expect(service['companyServiceId'], 'c1_svc1');
      expect(service['serviceName'], 'Software Installation');
      expect(service['productName'], '');
      expect(service.containsKey('productId'), isFalse);
    });

    test('the repository trims the names and returns the fixed id', () async {
      final remote = _RecordingRemote();
      final id = await ChatsRepositoryImpl(remote).openProductInquiry(
        customerId: 'cust1',
        customerName: '  Amna ',
        companyId: 'c1',
        companyName: ' Nile Tech ',
        productId: 'p1',
        productName: 'Router',
      );
      expect(id, 'cust1_product_p1');
      expect(remote.calls.single, {
        'customerName': 'Amna',
        'companyName': 'Nile Tech',
        'productId': 'p1',
      });
    });
  });

  group('product page: Contact next to Buy Now', () {
    testWidgets('both buttons sit side by side in the bottom bar',
        (tester) async {
      await tester.pumpWidget(
        _app(ProductDetailsScreen(product: _product()), _FakeChats()),
      );
      await tester.pump();

      expect(_button('Contact'), findsOneWidget);
      expect(_button('Buy Now'), findsOneWidget);
      // Same row, Contact first (to the left in English).
      final contact = tester.getRect(_button('Contact'));
      final buy = tester.getRect(_button('Buy Now'));
      expect(contact.center.dy, buy.center.dy);
      expect(contact.left, lessThan(buy.left));
      // Buying stays the main action while the product can be bought.
      expect(tester.widget(_button('Contact')), isA<OutlinedButton>());
      expect(tester.widget(_button('Buy Now')), isA<FilledButton>());
      // The total moved above the buttons.
      expect(find.text('Total'), findsOneWidget);
    });

    testWidgets('tapping Contact opens the conversation about this product',
        (tester) async {
      final chats = _FakeChats();
      await tester.pumpWidget(
        _app(ProductDetailsScreen(product: _product()), chats),
      );
      await tester.pump();

      await tester.tap(_button('Contact'));
      await tester.pumpAndSettle();

      expect(chats.opened.single, {
        'customerId': 'cust1',
        'customerName': 'Amna Ali',
        'companyId': 'c1',
        'companyName': 'Nile Tech',
        'productId': 'real1',
        'productName': 'Router',
      });
      expect(find.byType(ChatScreen), findsOneWidget);
      expect(find.text('Question: Router'), findsOneWidget);
      expect(
        find.text('A question before ordering - no order yet'),
        findsOneWidget,
      );
      // There is no order or request behind it to open yet.
      expect(find.byIcon(Icons.info_outline), findsNothing);
    });

    testWidgets('without a price, Contact becomes the main action',
        (tester) async {
      final unpriced = _product(price: null);
      await tester.pumpWidget(_app(
        ProductDetailsScreen(product: unpriced),
        _FakeChats(),
        catalogue: [unpriced],
      ));
      await tester.pump();

      expect(tester.widget(_button('Contact')), isA<FilledButton>());
      final buy = tester.widget<FilledButton>(_button('Buy Now'));
      expect(buy.onPressed, isNull);
    });

    testWidgets('a demo product has no real company to write to',
        (tester) async {
      await tester.pumpWidget(
        _app(ProductDetailsScreen(product: _product(id: 'p1')), _FakeChats()),
      );
      await tester.pump();

      expect(find.text('Contact'), findsNothing);
      expect(_button('Buy Now'), findsOneWidget);
    });

    testWidgets('a refusal is explained and nothing opens', (tester) async {
      final chats = _FakeChats(
        failWith: const AppException(AppErrorCode.chatInquiryDenied),
      );
      await tester.pumpWidget(
        _app(ProductDetailsScreen(product: _product()), chats),
      );
      await tester.pump();

      await tester.tap(_button('Contact'));
      await tester.pumpAndSettle();

      expect(find.text("You can't message this company right now."),
          findsOneWidget);
      expect(find.byType(ChatScreen), findsNothing);
    });

    testWidgets('Arabic: تواصل next to اشترِ الآن, right-to-left',
        (tester) async {
      await tester.pumpWidget(
        _app(
          ProductDetailsScreen(product: _product()),
          _FakeChats(),
          locale: _ar,
        ),
      );
      await tester.pump();

      final contact = tester.getRect(_button('تواصل'));
      final buy = tester.getRect(_button('اشترِ الآن'));
      expect(contact.center.dy, buy.center.dy);
      // Contact comes first, which is on the right in Arabic.
      expect(contact.left, greaterThan(buy.left));
    });
  });

  group('service page: Contact next to Request service', () {
    final service = CatalogService(
      id: 'svc1',
      categoryId: 'cat1',
      name: 'Software Installation',
      description: '',
      isActive: true,
      createdAt: _created,
    );
    final offer = ServiceOffer(
      company: _company,
      offer: CompanyService(
        id: 'c1_svc1',
        companyId: 'c1',
        serviceId: 'svc1',
        isActive: true,
        createdAt: _created,
        price: 15000,
      ),
    );

    testWidgets('each company offering it has both, and Contact asks it',
        (tester) async {
      final chats = _FakeChats();
      await tester.pumpWidget(_app(
        Scaffold(
          body: SingleChildScrollView(
            child: ServiceOfferCard(service: service, offer: offer),
          ),
        ),
        chats,
      ));
      await tester.pump();

      final contact = tester.getRect(_button('Contact'));
      final request = tester.getRect(_button('Request service'));
      expect(contact.center.dy, request.center.dy);

      await tester.tap(_button('Contact'));
      await tester.pumpAndSettle();

      expect(chats.opened.single, {
        'customerId': 'cust1',
        'customerName': 'Amna Ali',
        'companyId': 'c1',
        'companyName': 'Nile Tech',
        'companyServiceId': 'c1_svc1',
        'serviceName': 'Software Installation',
      });
      expect(find.text('Question: Software Installation'), findsOneWidget);
    });
  });

  testWidgets('the conversation list marks a question as one', (tester) async {
    final chats = _FakeChats()..conversation = _inquiry();
    await tester.pumpWidget(_app(
      const Scaffold(body: ChatsListScreen(role: ChatParticipantRole.customer)),
      chats,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Nile Tech'), findsOneWidget);
    expect(find.text('Question: Router'), findsOneWidget);
  });
}

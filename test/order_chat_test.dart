import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/chats/domain/entities/chat_conversation.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_screen.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/orders/company_order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/domain/repositories/orders_repository.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

OrderEntity _order() => OrderEntity(
      id: 'o1',
      customerId: 'cust1',
      companyId: 'c1',
      companyName: 'Nile Tech',
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
      customerName: 'Amna',
      createdAt: DateTime(2026, 9, 20),
    );

ChatConversation _orderConversation() => ChatConversation(
      id: 'o1',
      orderId: 'o1',
      customerId: 'cust1',
      companyId: 'c1',
      customerName: 'Amna',
      companyName: 'Nile Tech',
      productName: 'Router',
      createdAt: DateTime(2026, 9, 20),
    );

class _RecordingOrders extends Fake implements OrdersRepository {
  final started = <OrderEntity>[];

  @override
  Future<void> startChat(OrderEntity order) async {
    started.add(order);
  }
}

Widget _app(
  Widget home, {
  ChatConversation? conversation,
  OrdersRepository? orders,
}) {
  return ProviderScope(
    overrides: [
      chatConversationProvider('o1').overrideWith((_) => Stream.value(conversation)),
      chatMessagesProvider('o1').overrideWith((_) => Stream.value(const [])),
      if (orders != null) ordersRepositoryProvider.overrideWithValue(orders),
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: home,
    ),
  );
}

void main() {
  group('the chat entities carry what an order chat needs', () {
    test('isOrderChat and subjectLabel tell an order apart from a service request', () {
      final order = _orderConversation();
      expect(order.isOrderChat, isTrue);
      expect(order.subjectLabel, 'Router');

      final request = ChatConversation(
        id: 'r1',
        serviceRequestId: 'r1',
        customerId: 'cust1',
        companyId: 'c1',
        customerName: 'Amna',
        companyName: 'Nile Tech',
        serviceName: 'Installation',
        createdAt: DateTime(2026),
      );
      expect(request.isOrderChat, isFalse);
      expect(request.subjectLabel, 'Installation');
    });
  });

  group('customer: contacting the company from an order', () {
    testWidgets('an order with no conversation yet offers to start one', (tester) async {
      final orders = _RecordingOrders();
      await tester.pumpWidget(
        _app(OrderDetailsScreen(order: _order()), conversation: null, orders: orders),
      );
      await tester.pumpAndSettle();

      expect(find.text('Start a conversation'), findsOneWidget);
      await tester.tap(find.text('Start a conversation'));
      await tester.pumpAndSettle();

      expect(orders.started, hasLength(1));
      expect(orders.started.single.id, 'o1');
      // Navigated into the (now open) conversation.
      expect(find.byType(ChatScreen), findsOneWidget);
    });

    testWidgets('an order that already has one opens it directly', (tester) async {
      final orders = _RecordingOrders();
      await tester.pumpWidget(
        _app(
          OrderDetailsScreen(order: _order()),
          conversation: _orderConversation(),
          orders: orders,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Open chat'), findsOneWidget);
      await tester.tap(find.text('Open chat'));
      await tester.pumpAndSettle();

      expect(orders.started, isEmpty); // no need to start one again
      expect(find.byType(ChatScreen), findsOneWidget);
    });
  });

  group('company: contacting the customer from an order', () {
    Widget companyScreen(OrdersRepository orders, ChatConversation? conversation) {
      return ProviderScope(
        overrides: [
          companyOrdersStreamProvider('c1').overrideWith((_) => Stream.value([_order()])),
          chatConversationProvider('o1').overrideWith((_) => Stream.value(conversation)),
          chatMessagesProvider('o1').overrideWith((_) => Stream.value(const [])),
          ordersRepositoryProvider.overrideWithValue(orders),
        ],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: [Locale('en'), Locale('ar')],
          home: CompanyOrderDetailsScreen(companyId: 'c1', orderId: 'o1'),
        ),
      );
    }

    testWidgets('offers to start a conversation when there is none yet', (tester) async {
      final orders = _RecordingOrders();
      await tester.pumpWidget(companyScreen(orders, null));
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.text('Start a conversation'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(find.text('Start a conversation'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Start a conversation'));
      await tester.pumpAndSettle();

      expect(orders.started, hasLength(1));
      expect(find.byType(ChatScreen), findsOneWidget);
    });

    testWidgets('opens an existing conversation directly', (tester) async {
      final orders = _RecordingOrders();
      await tester.pumpWidget(companyScreen(orders, _orderConversation()));
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.text('Open chat'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(find.text('Open chat'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Open chat'));
      await tester.pumpAndSettle();

      expect(orders.started, isEmpty);
      expect(find.byType(ChatScreen), findsOneWidget);
    });
  });
}

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sudan_it_marketplace/core/push/push_relay.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/chats/data/datasources/chats_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/chats/data/repositories/chats_repository_impl.dart';
import 'package:sudan_it_marketplace/features/chats/domain/entities/chat_conversation.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_screen.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/orders/company_order_details_screen.dart';
import 'package:sudan_it_marketplace/features/notifications/data/datasources/notifications_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/notifications/data/models/app_notification_model.dart';
import 'package:sudan_it_marketplace/features/notifications/data/repositories/notifications_repository_impl.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_events.dart';
import 'package:sudan_it_marketplace/features/push/data/push_tokens.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_destination.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_setup.dart';

class _RecordingRelay implements PushRelay {
  final notifications = <String>[];
  final messages = <(String, String)>[];

  @override
  bool get isEnabled => true;

  @override
  Future<void> notification(String notificationId) async =>
      notifications.add(notificationId);

  @override
  Future<void> chatMessage({
    required String chatId,
    required String messageId,
  }) async =>
      messages.add((chatId, messageId));
}

class _FakeNotificationsRemote extends Fake
    implements NotificationsRemoteDataSource {
  _FakeNotificationsRemote({required this.stores});

  final bool stores;

  @override
  Future<bool> createNotification(AppNotification notification) async => stores;
}

class _FakeChatsRemote extends Fake implements ChatsRemoteDataSource {
  @override
  Future<String> sendMessage({
    required String chatId,
    required String senderId,
    required ChatParticipantRole senderRole,
    required String senderName,
    required String text,
  }) async =>
      'msg-7';
}

UserProfile _profile(UserRole role, {String? companyId}) => UserProfile(
      id: 'u1',
      fullName: 'Amna',
      email: 'amna@example.test',
      role: role,
      createdAt: DateTime(2026, 9, 29),
      isActive: true,
      companyId: companyId,
    );

AppNotification _newOrder() => NotificationEvents.newOrder(
      orderId: 'o1',
      companyId: 'c1',
      productName: 'Router',
    );

void main() {
  group('the relay client', () {
    test('asks the relay with the signed-in user\'s token and only ids', () async {
      final requests = <http.Request>[];
      final relay = HttpPushRelay(
        baseUrl: 'https://relay.example/',
        idToken: () async => 'id-token',
        client: MockClient((request) async {
          requests.add(request);
          return http.Response('{"sent":1}', 200);
        }),
      );

      await relay.notification('n1');
      await relay.chatMessage(chatId: 'chat1', messageId: 'm1');

      expect(requests.map((r) => r.url.toString()),
          everyElement('https://relay.example/push'));
      expect(requests.first.headers['Authorization'], 'Bearer id-token');
      expect(jsonDecode(requests[0].body), {'notificationId': 'n1'});
      expect(jsonDecode(requests[1].body), {'chatId': 'chat1', 'messageId': 'm1'});
    });

    test('signed out: nothing is sent', () async {
      var calls = 0;
      final relay = HttpPushRelay(
        baseUrl: 'https://relay.example',
        idToken: () async => null,
        client: MockClient((_) async {
          calls++;
          return http.Response('', 200);
        }),
      );
      await relay.notification('n1');
      expect(calls, 0);
    });

    test('a failing relay never reaches the user', () async {
      final down = HttpPushRelay(
        baseUrl: 'https://relay.example',
        idToken: () async => 'id-token',
        client: MockClient((_) async => throw http.ClientException('offline')),
      );
      final refusing = HttpPushRelay(
        baseUrl: 'https://relay.example',
        idToken: () async => 'id-token',
        client: MockClient((_) async => http.Response('{"error":"x"}', 502)),
      );
      await expectLater(down.notification('n1'), completes);
      await expectLater(refusing.notification('n1'), completes);
    });

    test('switched off by default (no relay address configured)', () {
      expect(pushRelayUrl, isEmpty);
      expect(const NoPushRelay().isEnabled, isFalse);
    });
  });

  group('what triggers a push', () {
    test('a notification, once it is stored', () async {
      final relay = _RecordingRelay();
      await NotificationsRepositoryImpl(
        _FakeNotificationsRemote(stores: true),
        relay,
      ).createNotification(_newOrder());
      expect(relay.notifications, ['o1_new_order']);
    });

    test('not a notification that could not be stored', () async {
      final relay = _RecordingRelay();
      await NotificationsRepositoryImpl(
        _FakeNotificationsRemote(stores: false),
        relay,
      ).createNotification(_newOrder());
      expect(relay.notifications, isEmpty);
    });

    test('every chat message sent', () async {
      final relay = _RecordingRelay();
      await ChatsRepositoryImpl(_FakeChatsRemote(), relay).sendMessage(
        chatId: 'chat1',
        senderId: 'u1',
        senderRole: ChatParticipantRole.customer,
        senderName: 'Amna',
        text: ' Is it available? ',
      );
      expect(relay.messages, [('chat1', 'msg-7')]);
    });

    test('a notification is signed with its sender', () {
      final signed =
          AppNotificationModel.toFirestoreCreateMap(_newOrder(), senderId: 'u1');
      expect(signed['senderId'], 'u1');
      expect(
        AppNotificationModel.toFirestoreCreateMap(_newOrder()).containsKey('senderId'),
        isFalse,
      );
    });
  });

  group('the phones remembered for a user', () {
    test('a new phone is added last', () {
      expect(nextPushTokens(['a'], 'b'), ['a', 'b']);
    });

    test('a known phone moves last instead of repeating', () {
      expect(nextPushTokens(['a', 'b', 'c'], 'a'), ['b', 'c', 'a']);
      expect(nextPushTokens(['a', 'b'], 'b'), ['a', 'b']);
    });

    test('only the newest five are kept', () {
      expect(
        nextPushTokens(['1', '2', '3', '4', '5'], '6'),
        ['2', '3', '4', '5', '6'],
      );
    });
  });

  group('where a tapped push leads', () {
    test('a chat message opens the conversation, for the side it was sent to', () {
      final company = pushDestination(
        {'type': 'chat_message', 'chatId': 'chat1', 'role': 'company'},
        _profile(UserRole.companyAdmin, companyId: 'c1'),
      );
      expect(company, isA<ChatDestination>());
      expect((company as ChatDestination).role, ChatParticipantRole.company);

      final customer = pushDestination(
        {'type': 'chat_message', 'chatId': 'chat1', 'role': 'customer'},
        _profile(UserRole.customer),
      );
      expect((customer as ChatDestination).role, ChatParticipantRole.customer);
    });

    test('never into a screen meant for another kind of account', () {
      expect(
        pushDestination(
          {'type': 'chat_message', 'chatId': 'chat1', 'role': 'company'},
          _profile(UserRole.customer),
        ),
        isNull,
      );
      expect(
        pushDestination(
          {'type': 'new_order', 'orderId': 'o1', 'recipientType': 'company_admin'},
          _profile(UserRole.customer),
        ),
        isNull,
      );
    });

    test("an order notification opens that order, on each side", () {
      final company = pushDestination(
        {'type': 'new_order', 'orderId': 'o1', 'recipientType': 'company_admin'},
        _profile(UserRole.companyAdmin, companyId: 'c1'),
      );
      expect(company, isA<CompanyOrderDestination>());
      expect((company as CompanyOrderDestination).companyId, 'c1');
      expect(
        pushDestination(
          {'type': 'order_completed', 'orderId': 'o1', 'recipientType': 'customer'},
          _profile(UserRole.customer),
        ),
        isA<CustomerOrderDestination>(),
      );
    });

    test('a technician job, or a push without ids, just opens the app', () {
      expect(
        pushDestination(
          {'type': 'technician_assigned', 'orderId': 'o1', 'recipientType': 'technician'},
          _profile(UserRole.technician, companyId: 'c1'),
        ),
        isNull,
      );
      expect(pushDestination({'type': 'chat_message'}, _profile(UserRole.customer)), isNull);
      expect(pushDestination({}, _profile(UserRole.customer)), isNull);
    });

    test('each destination has its screen', () {
      final chat = pushDestinationScreen(
        const ChatDestination('chat1', ChatParticipantRole.company),
      );
      expect(chat, isA<ChatScreen>());
      expect((chat as ChatScreen).chatId, 'chat1');
      final order = pushDestinationScreen(const CompanyOrderDestination('c1', 'o1'));
      expect(order, isA<CompanyOrderDetailsScreen>());
    });
  });
}

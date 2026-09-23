import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart'
    as catalog;
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/chats/domain/entities/chat_conversation.dart';
import 'package:sudan_it_marketplace/features/chats/domain/entities/chat_message.dart';
import 'package:sudan_it_marketplace/features/chats/domain/repositories/chats_repository.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_screen.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chats_list_screen.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/company_services/domain/entities/company_service.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/dashboard_home_tab.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/service_requests/data/models/service_request_model.dart';
import 'package:sudan_it_marketplace/features/service_requests/domain/entities/service_request.dart';
import 'package:sudan_it_marketplace/features/service_requests/domain/repositories/service_requests_repository.dart';
import 'package:sudan_it_marketplace/features/service_requests/presentation/service_request_actions.dart';
import 'package:sudan_it_marketplace/features/service_requests/presentation/service_request_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_details_screen.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _en = Locale('en');
const _ar = Locale('ar');

Widget _app(Widget home, {Locale locale = _en, List overrides = const []}) {
  return ProviderScope(
    // ignore: argument_type_not_assignable
    overrides: overrides.cast(),
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [_en, _ar],
      home: home,
    ),
  );
}

final _created = DateTime(2026, 9, 20, 10);

CatalogService _service(String id, String name, {String categoryId = 'cat1'}) =>
    CatalogService(
      id: id,
      categoryId: categoryId,
      name: name,
      description: 'Install and configure $name',
      isActive: true,
      createdAt: _created,
    );

CompanyService _link(String companyId, {double? price, String? note}) =>
    CompanyService(
      id: '${companyId}_svc1',
      companyId: companyId,
      serviceId: 'svc1',
      isActive: true,
      createdAt: _created,
      price: price,
      note: note,
    );

Company _company(String id, String name, {String status = 'active'}) =>
    Company(id: id, name: name, rating: 4.5, reviewCount: 3, status: status);

ChatConversation _conversation({
  DateTime? lastMessageAt,
  ChatParticipantRole? lastSender,
  DateTime? customerReadAt,
  DateTime? companyReadAt,
}) =>
    ChatConversation(
      id: 'req1',
      serviceRequestId: 'req1',
      customerId: 'cust1',
      companyId: 'c1',
      customerName: 'Amna',
      companyName: 'Nile Tech',
      serviceName: 'Software Installation',
      createdAt: _created,
      lastMessageText: lastMessageAt == null ? null : 'Hello',
      lastMessageAt: lastMessageAt,
      lastMessageSenderRole: lastSender,
      customerLastReadAt: customerReadAt,
      companyLastReadAt: companyReadAt,
    );

ServiceRequest _request({
  ServiceRequestStatus status = ServiceRequestStatus.pending,
  double? price,
}) =>
    ServiceRequest(
      id: 'req1',
      customerId: 'cust1',
      customerName: 'Amna',
      companyId: 'c1',
      companyName: 'Nile Tech',
      companyServiceId: 'c1_svc1',
      serviceId: 'svc1',
      serviceName: 'Software Installation',
      details: 'Install Office on 3 PCs',
      address: 'Khartoum 2',
      contactPhone: '+249912345678',
      status: status,
      createdAt: _created,
      price: price,
    );

/// A live value like a Firestore snapshot stream: a new listener first gets
/// the latest value, then every later one.
class _Live<T> {
  T? _latest;
  bool _hasValue = false;
  final _controller = StreamController<T>.broadcast();

  void add(T value) {
    _latest = value;
    _hasValue = true;
    _controller.add(value);
  }

  Stream<T> get stream async* {
    if (_hasValue) yield _latest as T;
    yield* _controller.stream;
  }
}

class _FakeChats extends Fake implements ChatsRepository {
  final conversation = _Live<ChatConversation?>();
  final messages = _Live<List<ChatMessage>>();
  final sent = <String>[];
  final sentRoles = <ChatParticipantRole>[];
  final reads = <ChatParticipantRole>[];

  @override
  Stream<ChatConversation?> watchConversation(String chatId) =>
      conversation.stream;

  @override
  Stream<List<ChatMessage>> watchMessages(String chatId) => messages.stream;

  @override
  Future<void> sendMessage({
    required String chatId,
    required String senderId,
    required ChatParticipantRole senderRole,
    required String senderName,
    required String text,
  }) async {
    sent.add(text.trim());
    sentRoles.add(senderRole);
  }

  @override
  Future<void> markRead({
    required String chatId,
    required ChatParticipantRole role,
  }) async {
    reads.add(role);
  }
}

class _RecordingRequests extends Fake implements ServiceRequestsRepository {
  final created = <ServiceRequest>[];

  @override
  String newServiceRequestId() => 'req-new';

  @override
  Future<void> createServiceRequest(ServiceRequest request) async =>
      created.add(request);
}

class _FakeProfile extends ProfileController {
  @override
  Future<UserProfile?> build() async => UserProfile(
        id: 'cust1',
        fullName: 'Amna Ali',
        email: 'amna@example.test',
        role: UserRole.customer,
        createdAt: _created,
        isActive: true,
        phone: '+249911111111',
      );
}

ChatMessage _message(String id, String text, ChatParticipantRole role,
        {String name = ''}) =>
    ChatMessage(
      id: id,
      senderId: role == ChatParticipantRole.customer ? 'cust1' : 'admin1',
      senderRole: role,
      senderName: name,
      text: text,
      createdAt: DateTime.now(),
    );

void main() {
  group('service details: companies and prices', () {
    List detailsOverrides(List<CompanyService> links, List<Company> companies) =>
        [
          companiesOfferingServiceProvider('svc1')
              .overrideWith((ref) => Stream.value(links)),
          firestoreCompaniesStreamProvider
              .overrideWith((ref) => Stream.value(companies)),
          allCategoriesProvider.overrideWith((ref) => Stream.value(const [])),
        ];

    testWidgets('a set price is shown; no price shows nothing at all',
        (tester) async {
      await tester.pumpWidget(_app(
        ServiceDetailsScreen(service: _service('svc1', 'Software Installation')),
        overrides: detailsOverrides(
          [_link('c1', price: 15000), _link('c2')],
          [_company('c1', 'Nile Tech'), _company('c2', 'Blue Nile IT')],
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Software Installation'), findsOneWidget);
      expect(find.text('Nile Tech'), findsOneWidget);
      expect(find.text('Blue Nile IT'), findsOneWidget);
      expect(find.text('15,000 SDG'), findsOneWidget);
      // The unpriced offer shows no price, no zero and no placeholder.
      expect(find.textContaining('SDG'), findsOneWidget);
      expect(find.text('0 SDG'), findsNothing);
      expect(find.text('Price on request'), findsNothing);
      expect(find.text('السعر عند التواصل'), findsNothing);
      expect(find.text('Request service'), findsNWidgets(2));
    });

    testWidgets('deactivated, pending and unknown companies never appear',
        (tester) async {
      await tester.pumpWidget(_app(
        ServiceDetailsScreen(service: _service('svc1', 'Software Installation')),
        overrides: detailsOverrides(
          [_link('c1'), _link('c2'), _link('c3'), _link('ghost')],
          [
            _company('c1', 'Nile Tech'),
            _company('c2', 'Closed Co', status: 'inactive'),
            _company('c3', 'Waiting Co', status: 'pending'),
          ],
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Nile Tech'), findsOneWidget);
      expect(find.text('Closed Co'), findsNothing);
      expect(find.text('Waiting Co'), findsNothing);
      expect(find.text('Request service'), findsOneWidget);
    });

    testWidgets('Arabic is right-to-left and translated', (tester) async {
      await tester.pumpWidget(_app(
        ServiceDetailsScreen(service: _service('svc1', 'تثبيت البرامج')),
        locale: _ar,
        overrides: detailsOverrides(
          [_link('c1')],
          [_company('c1', 'النيل تك')],
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('تفاصيل الخدمة'), findsOneWidget);
      expect(find.text('الشركات المتاحة'), findsOneWidget);
      expect(find.text('اطلب الخدمة'), findsOneWidget);
      expect(find.text('السعر عند التواصل'), findsNothing);
      expect(
        Directionality.of(tester.element(find.text('النيل تك'))),
        TextDirection.rtl,
      );
    });
  });

  group('home services tab', () {
    List homeOverrides() => [
          firestoreProductsStreamProvider
              .overrideWith((ref) => Stream.value(const [])),
          firestoreCompaniesStreamProvider
              .overrideWith((ref) => Stream.value(const [])),
          activeServicesProvider(null).overrideWith(
            (ref) => Stream.value([
              _service('svc1', 'Software Installation'),
              _service('svc2', 'Network Setup'),
              _service('svc3', 'Old Service', categoryId: 'retired'),
            ]),
          ),
          allCategoriesProvider.overrideWith(
            (ref) => Stream.value([
              catalog.Category(
                id: 'cat1',
                name: 'IT',
                description: '',
                iconName: '',
                isActive: true,
                createdAt: _created,
              ),
              catalog.Category(
                id: 'retired',
                name: 'Retired',
                description: '',
                iconName: '',
                isActive: false,
                createdAt: _created,
              ),
            ]),
          ),
        ];

    testWidgets('Products | Services | Companies, services are searchable',
        (tester) async {
      await tester.pumpWidget(_app(
        const Scaffold(body: DashboardHomeTab()),
        overrides: homeOverrides(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Products'), findsOneWidget);
      expect(find.text('Services'), findsOneWidget);
      expect(find.text('Companies'), findsOneWidget);

      await tester.tap(find.text('Services'));
      await tester.pumpAndSettle();
      expect(find.text('Software Installation'), findsOneWidget);
      expect(find.text('Network Setup'), findsOneWidget);
      // A service of a deactivated category is not offered to customers.
      expect(find.text('Old Service'), findsNothing);

      await tester.enterText(find.byType(TextField), 'network');
      await tester.pumpAndSettle();
      expect(find.text('Network Setup'), findsOneWidget);
      expect(find.text('Software Installation'), findsNothing);
    });

    testWidgets('the tabs are translated in Arabic', (tester) async {
      await tester.pumpWidget(_app(
        const Scaffold(body: DashboardHomeTab()),
        locale: _ar,
        overrides: homeOverrides(),
      ));
      await tester.pumpAndSettle();
      expect(find.text('الخدمات'), findsOneWidget);
      await tester.tap(find.text('الخدمات'));
      await tester.pumpAndSettle();
      expect(find.text('Software Installation'), findsOneWidget);
    });
  });

  group('company service price is optional', () {
    test('no price, a zero or a negative value mean "no price"', () {
      CompanyServiceModel model(Object? price) => CompanyServiceModel.fromMap(
            'x',
            {'companyId': 'c1', 'serviceId': 's1', 'isActive': true, 'price': price},
          );
      expect(model(null).price, isNull);
      expect(model(0).price, isNull);
      expect(model(-3).price, isNull);
      expect(model('100').price, isNull);
      expect(model(2500).price, 2500);
      expect(
        CompanyServiceModel.fromMap('x', {'companyId': 'c1'}).price,
        isNull,
      );
    });

    test('an empty price is written as null, never 0', () {
      final map = CompanyServiceModel(
        id: 'x',
        companyId: 'c1',
        serviceId: 's1',
        isActive: true,
        createdAt: _created,
      ).toFirestoreMap();
      expect(map['price'], isNull);
    });
  });

  group('service requests', () {
    test('a request is created pending, with no price when none was set', () {
      final map = ServiceRequestModel.toCreateMap(_request());
      expect(map['status'], 'pending');
      expect(map['price'], isNull);
      expect(map['companyServiceId'], 'c1_svc1');
      expect(map['serviceId'], 'svc1');
      expect(map['customerId'], 'cust1');
      expect(map['companyId'], 'c1');
      expect(map.containsKey('productId'), isFalse);
    });

    test('status values round-trip and final states are final', () {
      for (final status in ServiceRequestStatus.values) {
        expect(ServiceRequestStatus.fromValue(status.value), status);
      }
      expect(ServiceRequestStatus.fromValue('in_progress'),
          ServiceRequestStatus.inProgress);
      expect(ServiceRequestStatus.completed.isFinal, isTrue);
      expect(ServiceRequestStatus.pending.isFinal, isFalse);
      expect(_request().canCustomerCancel, isTrue);
      expect(
        _request(status: ServiceRequestStatus.accepted).canCustomerCancel,
        isFalse,
      );
    });

    test('submitting links customer, company, company service and service',
        () async {
      final requests = _RecordingRequests();
      final container = ProviderContainer(overrides: [
        serviceRequestsRepositoryProvider.overrideWithValue(requests),
        currentUserIdProvider.overrideWithValue('cust1'),
        profileControllerProvider.overrideWith(_FakeProfile.new),
      ]);
      addTearDown(container.dispose);
      await container.read(profileControllerProvider.future);

      final result = await container.read(serviceRequestActionsProvider).submit(
            service: _service('svc1', 'Software Installation'),
            offer: _link('c1', price: 15000),
            company: _company('c1', 'Nile Tech'),
            details: '  Install Office  ',
            address: '',
            location: null,
            contactPhone: '+249912345678',
          );

      expect(result.error, isNull);
      expect(result.requestId, 'req-new');
      final request = requests.created.single;
      expect(request.customerId, 'cust1');
      expect(request.customerName, 'Amna Ali');
      expect(request.companyId, 'c1');
      expect(request.companyServiceId, 'c1_svc1');
      expect(request.serviceId, 'svc1');
      expect(request.price, 15000);
      expect(request.status, ServiceRequestStatus.pending);
    });
  });

  group('unread indication', () {
    final at = DateTime(2026, 9, 21, 12);

    test('a message from the other side is unread until opened', () {
      final chat = _conversation(
        lastMessageAt: at,
        lastSender: ChatParticipantRole.company,
      );
      expect(chat.isUnreadFor(ChatParticipantRole.customer), isTrue);
      expect(chat.isUnreadFor(ChatParticipantRole.company), isFalse);

      final read = _conversation(
        lastMessageAt: at,
        lastSender: ChatParticipantRole.company,
        customerReadAt: at.add(const Duration(seconds: 1)),
      );
      expect(read.isUnreadFor(ChatParticipantRole.customer), isFalse);
    });

    test('a conversation without messages is never unread', () {
      expect(_conversation().isUnreadFor(ChatParticipantRole.customer), isFalse);
      expect(_conversation().isUnreadFor(ChatParticipantRole.company), isFalse);
    });

    testWidgets('the list marks unread conversations and counts them',
        (tester) async {
      final unread = _conversation(
        lastMessageAt: DateTime.now(),
        lastSender: ChatParticipantRole.company,
      );
      await tester.pumpWidget(_app(
        const Scaffold(
          body: ChatsListScreen(role: ChatParticipantRole.customer),
        ),
        overrides: [
          customerChatsStreamProvider
              .overrideWith((ref) => Stream.value([unread])),
        ],
      ));
      await tester.pumpAndSettle();
      final semantics = tester.ensureSemantics();
      expect(find.text('Nile Tech'), findsOneWidget);
      expect(find.text('Software Installation'), findsOneWidget);
      expect(find.text('Hello'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Unread')), findsOneWidget);
      semantics.dispose();

      final container = ProviderScope.containerOf(
        tester.element(find.byType(ChatsListScreen)),
      );
      expect(container.read(customerUnreadChatsCountProvider), 1);
    });
  });

  group('realtime chat', () {
    List chatOverrides(_FakeChats chats) => [
          chatsRepositoryProvider.overrideWithValue(chats),
          currentUserIdProvider.overrideWithValue('cust1'),
          serviceRequestStreamProvider('req1')
              .overrideWith((ref) => Stream.value(_request())),
        ];

    testWidgets(
        'messages arrive live, show their sender, and sending uses the '
        'viewer\'s role', (tester) async {
      final chats = _FakeChats();
      await tester.pumpWidget(_app(
        const ChatScreen(chatId: 'req1', role: ChatParticipantRole.customer),
        overrides: chatOverrides(chats),
      ));
      chats.conversation.add(_conversation(
        lastMessageAt: DateTime.now(),
        lastSender: ChatParticipantRole.company,
      ));
      chats.messages.add([
        _message('m1', 'Hello, how can we help?', ChatParticipantRole.company,
            name: 'Nile Tech'),
      ]);
      await tester.pumpAndSettle();

      expect(find.text('Hello, how can we help?'), findsOneWidget);
      // The company's name labels its message; the status bar is visible.
      expect(find.text('Nile Tech'), findsWidgets);
      expect(find.text('Request status: Pending'), findsOneWidget);
      // Opening an unread conversation records that the customer read it.
      expect(chats.reads, contains(ChatParticipantRole.customer));

      // A new message from the other side appears without reopening.
      chats.messages.add([
        _message('m1', 'Hello, how can we help?', ChatParticipantRole.company,
            name: 'Nile Tech'),
        _message('m2', 'We can come tomorrow.', ChatParticipantRole.company,
            name: 'Nile Tech'),
      ]);
      await tester.pumpAndSettle();
      expect(find.text('We can come tomorrow.'), findsOneWidget);

      await tester.enterText(find.byType(TextField), '  Tomorrow is fine  ');
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(chats.sent, ['Tomorrow is fine']);
      expect(chats.sentRoles, [ChatParticipantRole.customer]);
      // The field is cleared after a successful send.
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty,
      );

      chats.messages.add([
        _message('m1', 'Hello, how can we help?', ChatParticipantRole.company),
        _message('m2', 'We can come tomorrow.', ChatParticipantRole.company),
        _message('m3', 'Tomorrow is fine', ChatParticipantRole.customer),
      ]);
      await tester.pumpAndSettle();
      expect(find.text('Tomorrow is fine'), findsOneWidget);
      expect(find.text('You'), findsOneWidget);
    });

    testWidgets('an empty message is not sent', (tester) async {
      final chats = _FakeChats();
      await tester.pumpWidget(_app(
        const ChatScreen(chatId: 'req1', role: ChatParticipantRole.company),
        overrides: chatOverrides(chats),
      ));
      chats.conversation.add(_conversation());
      chats.messages.add(const []);
      await tester.pumpAndSettle();

      expect(find.text('No messages yet. Write to start the conversation.'),
          findsOneWidget);
      await tester.enterText(find.byType(TextField), '   ');
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      expect(chats.sent, isEmpty);
    });

    testWidgets('the chat is right-to-left in Arabic', (tester) async {
      final chats = _FakeChats();
      await tester.pumpWidget(_app(
        const ChatScreen(chatId: 'req1', role: ChatParticipantRole.customer),
        locale: _ar,
        overrides: chatOverrides(chats),
      ));
      chats.conversation.add(_conversation());
      chats.messages.add([
        _message('m1', 'مرحبا', ChatParticipantRole.customer),
      ]);
      await tester.pumpAndSettle();
      expect(find.text('أنت'), findsOneWidget);
      expect(find.text('حالة الطلب: قيد الانتظار'), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.text('مرحبا'))),
        TextDirection.rtl,
      );
    });
  });
}

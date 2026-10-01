import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/localization/app_locale.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/company_services/domain/entities/company_service.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/notifications/data/models/app_notification_model.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_events.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_format.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notifications_providers.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_destination.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_setup.dart';
import 'package:sudan_it_marketplace/features/service_requests/domain/entities/service_request.dart';
import 'package:sudan_it_marketplace/features/service_requests/domain/repositories/service_requests_repository.dart';
import 'package:sudan_it_marketplace/features/service_requests/presentation/service_request_actions.dart';
import 'package:sudan_it_marketplace/features/service_requests/presentation/service_request_details_screen.dart';
import 'package:sudan_it_marketplace/features/service_requests/presentation/service_request_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

class _Notifications extends Fake implements NotificationsRepository {
  _Notifications({this.failing = false});

  final bool failing;
  final created = <AppNotification>[];
  var _next = 0;

  @override
  String newNotificationId() => 'n${++_next}';

  @override
  Future<void> createNotification(AppNotification notification) async {
    if (failing) throw StateError('notifications are down');
    created.add(notification);
  }
}

class _Requests extends Fake implements ServiceRequestsRepository {
  final statuses = <ServiceRequestStatus>[];

  @override
  String newServiceRequestId() => 'req-new';

  @override
  Future<void> createServiceRequest(ServiceRequest request) async {}

  @override
  Future<void> updateStatus({
    required String requestId,
    required ServiceRequestStatus status,
  }) async => statuses.add(status);
}

class _CustomerProfile extends ProfileController {
  @override
  Future<UserProfile?> build() async => UserProfile(
    id: 'cust1',
    fullName: 'Amna Ali',
    email: 'amna@example.test',
    role: UserRole.customer,
    createdAt: DateTime(2026, 10, 1),
    isActive: true,
  );
}

ServiceRequest _request() => ServiceRequest(
  id: 'sr1',
  customerId: 'cust1',
  customerName: 'Amna Ali',
  companyId: 'c1',
  companyName: 'Nile Tech',
  companyServiceId: 'c1_svc1',
  serviceId: 'svc1',
  serviceName: 'Network setup',
  details: 'Office network',
  address: '',
  contactPhone: '+249912345678',
  status: ServiceRequestStatus.pending,
  createdAt: DateTime(2026, 10, 1),
);

UserProfile _profile(UserRole role, {String? companyId}) => UserProfile(
  id: 'u1',
  fullName: 'Amna',
  email: 'amna@example.test',
  role: role,
  createdAt: DateTime(2026, 10, 1),
  isActive: true,
  companyId: companyId,
);

AppNotification? _forStatus(ServiceRequestStatus status) =>
    NotificationEvents.forServiceRequestStatus(
      id: 'n1',
      status: status,
      serviceRequestId: 'sr1',
      customerId: 'cust1',
      companyId: 'c1',
      serviceName: 'Network setup',
    );

void main() {
  group('the notification for each step of a service request', () {
    test('a new request goes to the company', () {
      final n = NotificationEvents.newServiceRequest(
        id: 'n1',
        serviceRequestId: 'sr1',
        companyId: 'c1',
        serviceName: 'Network setup',
      );
      expect(n.recipientType, NotificationRecipientType.companyAdmin);
      expect(n.recipientId, 'c1');
      expect(n.serviceRequestId, 'sr1');
      expect(n.orderId, isEmpty);
      expect(n.type, 'new_service_request');
      expect(n.body, contains('"Network setup"'));
    });

    test("the company's answers go to the customer", () {
      const types = {
        ServiceRequestStatus.accepted: 'service_request_accepted',
        ServiceRequestStatus.rejected: 'service_request_rejected',
        ServiceRequestStatus.inProgress: 'service_request_in_progress',
        ServiceRequestStatus.completed: 'service_request_completed',
      };
      for (final entry in types.entries) {
        final n = _forStatus(entry.key)!;
        expect(n.type, entry.value, reason: '${entry.key}');
        expect(n.recipientType, NotificationRecipientType.customer);
        expect(n.recipientId, 'cust1');
        expect(n.serviceRequestId, 'sr1');
      }
    });

    test('a cancellation goes to the company; pending tells nobody', () {
      final n = _forStatus(ServiceRequestStatus.cancelled)!;
      expect(n.type, 'service_request_cancelled');
      expect(n.recipientType, NotificationRecipientType.companyAdmin);
      expect(n.recipientId, 'c1');
      expect(_forStatus(ServiceRequestStatus.pending), isNull);
    });

    test('it is stored about the request, never about an order', () {
      final map = AppNotificationModel.toFirestoreCreateMap(
        _forStatus(ServiceRequestStatus.accepted)!,
        senderId: 'ca1',
      );
      expect(map['serviceRequestId'], 'sr1');
      expect(map.containsKey('orderId'), isFalse);
      expect(map['senderId'], 'ca1');
    });
  });

  group('how it reads', () {
    final en = lookupAppLocalizations(AppLocale.english);
    final ar = lookupAppLocalizations(AppLocale.arabic);

    test("in the reader's language, with the service name", () {
      for (final status in [
        ServiceRequestStatus.accepted,
        ServiceRequestStatus.rejected,
        ServiceRequestStatus.inProgress,
        ServiceRequestStatus.completed,
        ServiceRequestStatus.cancelled,
      ]) {
        final n = _forStatus(status)!;
        for (final l10n in [en, ar]) {
          expect(NotificationFormat.body(l10n, n), contains('Network setup'));
        }
        // Arabic reads Arabic, not the stored English text.
        expect(NotificationFormat.title(ar, n), isNot(n.title));
        expect(NotificationFormat.body(ar, n), isNot(n.body));
      }
      final accepted = _forStatus(ServiceRequestStatus.accepted)!;
      expect(NotificationFormat.title(ar, accepted), 'تم قبول طلبك');
      expect(NotificationFormat.title(en, accepted), 'Request accepted');
      final created = NotificationEvents.newServiceRequest(
        id: 'n1',
        serviceRequestId: 'sr1',
        companyId: 'c1',
        serviceName: 'Network setup',
      );
      expect(NotificationFormat.title(ar, created), 'طلب خدمة جديد');
      expect(
        NotificationFormat.body(en, created),
        'A customer requested "Network setup".',
      );
    });

    test('each kind has its own icon, not the fallback bell', () {
      final bell = NotificationFormat.style(
        AppNotification(
          id: 'x',
          recipientType: NotificationRecipientType.customer,
          recipientId: 'u',
          type: 'unknown',
          title: 't',
          body: 'b',
          createdAt: DateTime(2026),
        ),
      ).icon;
      for (final status in ServiceRequestStatus.values) {
        final n = _forStatus(status);
        if (n == null) continue;
        expect(NotificationFormat.style(n).icon, isNot(bell), reason: n.type);
      }
    });
  });

  group('where a tapped push leads', () {
    const data = {
      'type': 'new_service_request',
      'serviceRequestId': 'sr1',
      'recipientType': 'company_admin',
    };

    test('the company opens the request as the company', () {
      final destination = pushDestination(
        data,
        _profile(UserRole.companyAdmin, companyId: 'c1'),
      );
      expect(destination, isA<ServiceRequestDestination>());
      expect((destination as ServiceRequestDestination).requestId, 'sr1');
      expect(destination.asCompany, isTrue);
    });

    test('the customer opens it as the customer', () {
      final destination = pushDestination({
        ...data,
        'type': 'service_request_accepted',
        'recipientType': 'customer',
      }, _profile(UserRole.customer));
      expect((destination as ServiceRequestDestination).asCompany, isFalse);
    });

    test('never into the screen of another kind of account', () {
      expect(pushDestination(data, _profile(UserRole.customer)), isNull);
      expect(
        pushDestination({
          ...data,
          'recipientType': 'customer',
        }, _profile(UserRole.companyAdmin, companyId: 'c1')),
        isNull,
      );
    });

    test('the destination has its screen', () {
      final screen = pushDestinationScreen(
        const ServiceRequestDestination('sr1', asCompany: true),
      );
      expect(screen, isA<ServiceRequestDetailsScreen>());
      expect((screen as ServiceRequestDetailsScreen).requestId, 'sr1');
      expect(screen.asCompany, isTrue);
    });
  });

  group('sending them', () {
    ProviderContainer containerWith(
      _Notifications notifications,
      _Requests requests,
    ) {
      final container = ProviderContainer(
        overrides: [
          notificationsRepositoryProvider.overrideWithValue(notifications),
          serviceRequestsRepositoryProvider.overrideWithValue(requests),
          currentUserIdProvider.overrideWithValue('cust1'),
          profileControllerProvider.overrideWith(_CustomerProfile.new),
        ],
      );
      addTearDown(container.dispose);
      return container;
    }

    Future<String?> submit(ProviderContainer container) async {
      await container.read(profileControllerProvider.future);
      final result = await container
          .read(serviceRequestActionsProvider)
          .submit(
            service: CatalogService(
              id: 'svc1',
              categoryId: 'cat1',
              name: 'Network setup',
              description: '',
              isActive: true,
              createdAt: DateTime(2026, 10, 1),
            ),
            offer: CompanyService(
              id: 'c1_svc1',
              companyId: 'c1',
              serviceId: 'svc1',
              isActive: true,
              createdAt: DateTime(2026, 10, 1),
            ),
            company: const Company(
              id: 'c1',
              name: 'Nile Tech',
              rating: 0,
              reviewCount: 0,
            ),
            details: 'Office network',
            address: '',
            location: null,
            contactPhone: '+249912345678',
          );
      return result.error;
    }

    test('a new request tells the company', () async {
      final notifications = _Notifications();
      final container = containerWith(notifications, _Requests());
      expect(await submit(container), isNull);
      final n = notifications.created.single;
      expect(n.type, 'new_service_request');
      expect(n.recipientId, 'c1');
      expect(n.serviceRequestId, 'req-new');
    });

    test('a new status tells the other side; pending tells nobody', () async {
      final notifications = _Notifications();
      final requests = _Requests();
      final actions = containerWith(
        notifications,
        requests,
      ).read(serviceRequestActionsProvider);

      expect(
        await actions.updateStatus(_request(), ServiceRequestStatus.accepted),
        isNull,
      );
      expect(await actions.cancel(_request()), isNull);
      expect(
        await actions.updateStatus(_request(), ServiceRequestStatus.pending),
        isNull,
      );

      expect(requests.statuses, [
        ServiceRequestStatus.accepted,
        ServiceRequestStatus.cancelled,
        ServiceRequestStatus.pending,
      ]);
      expect(notifications.created.map((n) => (n.type, n.recipientType)), [
        ('service_request_accepted', NotificationRecipientType.customer),
        ('service_request_cancelled', NotificationRecipientType.companyAdmin),
      ]);
    });

    test(
      'a notification that cannot be sent never fails the request',
      () async {
        final requests = _Requests();
        final container = containerWith(
          _Notifications(failing: true),
          requests,
        );
        expect(await submit(container), isNull);
        final actions = container.read(serviceRequestActionsProvider);
        expect(
          await actions.updateStatus(
            _request(),
            ServiceRequestStatus.completed,
          ),
          isNull,
        );
        expect(requests.statuses, [ServiceRequestStatus.completed]);
      },
    );
  });
}

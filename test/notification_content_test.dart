import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/notifications/data/datasources/notifications_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/notifications/data/models/app_notification_model.dart';
import 'package:sudan_it_marketplace/features/notifications/data/repositories/notifications_repository_impl.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_events.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_format.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/widgets/notification_tile.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

/// The fields a new notification may carry: exactly the list the security
/// rules accept (hasRequiredNotificationKeys in firestore.rules). There is no
/// `title` or `body`.
const _storedKeys = {
  'id',
  'recipientType',
  'recipientId',
  'orderId',
  'type',
  'productName',
  'isRead',
  'createdAt',
  'senderId',
};

/// Every notification the app sends, one of each type.
List<AppNotification> _everyEvent() => [
      NotificationEvents.newOrder(
          orderId: 'o1', companyId: 'c1', productName: 'Router'),
      NotificationEvents.newReview(
          orderId: 'o1', companyId: 'c1', productName: 'Router'),
      NotificationEvents.paymentConfirmed(
          orderId: 'o1', customerId: 'cust1', productName: 'Router'),
      NotificationEvents.orderOutForDelivery(
          orderId: 'o1', customerId: 'cust1', productName: 'Router'),
      NotificationEvents.orderCompleted(
          orderId: 'o1', customerId: 'cust1', productName: 'Router'),
      NotificationEvents.reviewReply(
          orderId: 'o1', customerId: 'cust1', productName: 'Router'),
      NotificationEvents.technicianAssigned(
          orderId: 'o1', technicianId: 't1', productName: 'Router'),
    ];

class _RecordingRemote extends Fake implements NotificationsRemoteDataSource {
  final deleted = <String>[];

  @override
  Future<void> deleteNotification(String notificationId) async =>
      deleted.add(notificationId);
}

Widget _app(Widget child) => MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(body: child),
    );

void main() {
  final en = AppLocalizationsEn();
  final ar = AppLocalizationsAr();

  group('what a notification stores', () {
    test('the app sends exactly the known types, one event each', () {
      // Seven about orders (built here) and six about service requests (see
      // service_request_notifications_test.dart).
      final orderTypes = _everyEvent().map((n) => n.type).toSet();
      expect(orderTypes, hasLength(7));
      const serviceRequestTypes = {
        NotificationTypes.newServiceRequest,
        NotificationTypes.serviceRequestAccepted,
        NotificationTypes.serviceRequestRejected,
        NotificationTypes.serviceRequestInProgress,
        NotificationTypes.serviceRequestCompleted,
        NotificationTypes.serviceRequestCancelled,
      };
      expect(NotificationTypes.all, {...orderTypes, ...serviceRequestTypes});
      expect(NotificationTypes.all, hasLength(13));
    });

    test('no title or body: only the listed fields, whatever the event', () {
      for (final event in _everyEvent()) {
        final stored =
            AppNotificationModel.toFirestoreCreateMap(event, senderId: 'u1');
        expect(stored.keys.toSet(), _storedKeys, reason: event.type);
        expect(stored['productName'], 'Router');
        expect(stored['type'], event.type);
        expect(stored['isRead'], isFalse);
      }
    });

    test('each goes to its own recipient', () {
      final byType = {for (final n in _everyEvent()) n.type: n};
      for (final type in ['new_order', 'new_review']) {
        expect(byType[type]!.recipientType, NotificationRecipientType.companyAdmin);
        expect(byType[type]!.recipientId, 'c1');
      }
      for (final type in [
        'payment_confirmed',
        'out_for_delivery',
        'order_completed',
        'review_reply',
      ]) {
        expect(byType[type]!.recipientType, NotificationRecipientType.customer);
        expect(byType[type]!.recipientId, 'cust1');
      }
      expect(
        byType['technician_assigned']!.recipientType,
        NotificationRecipientType.technician,
      );
      expect(byType['technician_assigned']!.recipientId, 't1');
    });

    test('a status change that is not a step sends nothing', () {
      for (final status in [OrderStatus.processing, OrderStatus.cancelled]) {
        expect(
          NotificationEvents.forOrderStatusChange(
            status: status,
            orderId: 'o1',
            customerId: 'cust1',
            productName: 'Router',
          ),
          isNull,
        );
      }
    });
  });

  group('one notification per order and type', () {
    test('the id is fixed by the order and the type', () {
      final first = NotificationEvents.newOrder(
          orderId: 'o1', companyId: 'c1', productName: 'Router');
      final again = NotificationEvents.newOrder(
          orderId: 'o1', companyId: 'c1', productName: 'Router');
      expect(first.id, 'o1_new_order');
      expect(again.id, first.id);
      expect(
        NotificationEvents.newOrder(
            orderId: 'o2', companyId: 'c1', productName: 'Router').id,
        'o2_new_order',
      );
      expect(
        NotificationEvents.paymentConfirmed(
            orderId: 'o1', customerId: 'cust1', productName: 'Router').id,
        'o1_payment_confirmed',
      );
    });

    test('an assignment is one per technician', () {
      String idFor(String technician) => NotificationEvents.technicianAssigned(
            orderId: 'o1',
            technicianId: technician,
            productName: 'Router',
          ).id;
      expect(idFor('t1'), 'o1_technician_assigned_t1');
      expect(idFor('t2'), 'o1_technician_assigned_t2');
    });

    test('every id is unique across the types of one order', () {
      final ids = _everyEvent().map((n) => n.id).toSet();
      expect(ids, hasLength(7));
    });
  });

  group('what the reader sees', () {
    test('every known type has its own words, in both languages', () {
      for (final event in _everyEvent()) {
        for (final l10n in [en, ar]) {
          expect(NotificationFormat.title(l10n, event),
              isNot(l10n.notifGenericTitle),
              reason: event.type);
          expect(NotificationFormat.body(l10n, event),
              isNot(l10n.notifGenericBody),
              reason: event.type);
        }
        if (event.type != NotificationTypes.orderCompleted) {
          expect(NotificationFormat.body(en, event), contains('Router'));
          expect(NotificationFormat.body(ar, event), contains('Router'));
        }
      }
    });

    test('text stored with an older notification is never shown', () {
      final legacy = AppNotificationModel.fromMap('n1', {
        'recipientType': 'company_admin',
        'recipientId': 'c1',
        'orderId': 'o1',
        'type': 'new_order',
        'title': 'Written by the sender',
        'body': 'Call "this number" now',
      });
      expect(legacy.productName, isEmpty);
      for (final l10n in [en, ar]) {
        expect(NotificationFormat.title(l10n, legacy), l10n.notifNewOrderTitle);
        expect(NotificationFormat.body(l10n, legacy), l10n.notifGenericBody);
      }
    });

    test('an unknown type shows the general message, never stored text', () {
      final unknown = AppNotificationModel.fromMap('n1', {
        'recipientType': 'company_admin',
        'recipientId': 'c1',
        'orderId': 'o1',
        'type': 'system_alert',
        'productName': 'Router',
        'title': 'Payment confirmed by the bank',
        'body': 'Deliver today',
      });
      expect(NotificationFormat.title(en, unknown), 'Notification');
      expect(
        NotificationFormat.body(en, unknown),
        'There is an update on one of your orders.',
      );
      expect(NotificationFormat.title(ar, unknown), 'إشعار');
      expect(NotificationFormat.body(ar, unknown), 'يوجد تحديث على أحد طلباتك.');
    });
  });

  group('deleting a notification', () {
    final notification = NotificationEvents.newOrder(
        orderId: 'o1', companyId: 'c1', productName: 'Router');

    testWidgets('a long press asks first, and Delete removes it',
        (tester) async {
      var deleted = 0;
      await tester.pumpWidget(_app(NotificationTile(
        notification: notification,
        onTap: () {},
        onDelete: () => deleted++,
      )));
      await tester.longPress(find.byType(NotificationTile));
      await tester.pumpAndSettle();
      expect(find.text('Delete this notification?'), findsOneWidget);
      expect(deleted, 0);

      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();
      expect(deleted, 1);
      expect(find.text('Delete this notification?'), findsNothing);
    });

    testWidgets('Cancel keeps it', (tester) async {
      var deleted = 0;
      await tester.pumpWidget(_app(NotificationTile(
        notification: notification,
        onTap: () {},
        onDelete: () => deleted++,
      )));
      await tester.longPress(find.byType(NotificationTile));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(deleted, 0);
    });

    testWidgets('a tile without a delete action does nothing on a long press',
        (tester) async {
      await tester.pumpWidget(_app(NotificationTile(
        notification: notification,
        onTap: () {},
      )));
      await tester.longPress(find.byType(NotificationTile));
      await tester.pumpAndSettle();
      expect(find.text('Delete this notification?'), findsNothing);
    });

    test('the repository deletes exactly that notification', () async {
      final remote = _RecordingRemote();
      await NotificationsRepositoryImpl(remote)
          .deleteNotification('o1_new_order');
      expect(remote.deleted, ['o1_new_order']);
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/dashboard/technician_dashboard_tab.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/jobs/technician_job_status_actions.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/jobs/technician_jobs_tab.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/technician_actions.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/technician_job_helpers.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/technician_notes_providers.dart';
import 'package:sudan_it_marketplace/features/location/domain/geo_location.dart';
import 'package:sudan_it_marketplace/features/technician/domain/technician_note.dart';
import 'package:sudan_it_marketplace/features/technicians/domain/entities/technician.dart';
import 'package:sudan_it_marketplace/features/technicians/presentation/technicians_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

OrderEntity _job(
  String id, {
  String product = 'Router',
  OrderStatus status = OrderStatus.processing,
  PaymentStatus payment = PaymentStatus.confirmed,
  DeliveryMethod method = DeliveryMethod.delivery,
  double fee = 100,
  DateTime? created,
  DateTime? updated,
  double? lat,
  double? lng,
}) {
  return OrderEntity(
    id: id,
    customerId: 'c1',
    customerName: 'Customer $id',
    companyId: 'co1',
    productId: 'p1',
    productName: product,
    quantity: 1,
    unitPrice: 10,
    productSubtotal: 10,
    installationSelected: true,
    installationFee: fee,
    deliveryFee: 0,
    totalAmount: 10,
    deliveryAddress: 'Street $id',
    contactPhone: '0911111111',
    deliveryMethod: method,
    paymentStatus: payment,
    orderStatus: status,
    technicianId: 't1',
    technicianName: 'Tech',
    deliveryLatitude: lat,
    deliveryLongitude: lng,
    createdAt: created ?? DateTime(2026, 10, 1),
    updatedAt: updated,
  );
}

class _FakeActions extends TechnicianActions {
  _FakeActions(super.ref);

  final finished = <String>[];
  final notes = <String>[];

  @override
  Future<String?> finishJob(OrderEntity order, {String note = ''}) async {
    finished.add(order.id);
    notes.add(note);
    return null;
  }
}

Widget _app(Widget home, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: [
      technicianPositionProvider.overrideWith((_) async => null),
      ...overrides,
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(body: home),
    ),
  );
}

Override _jobs(List<OrderEntity> jobs) => technicianOrdersStreamProvider('t1')
    .overrideWith((_) => Stream.value(jobs));

void main() {
  group('job helpers', () {
    test('the next job is a paid one, the nearest when distances are known', () {
      final far = _job('far', lat: 16.0, lng: 33.0);
      final near = _job('near', lat: 15.601, lng: 32.501);
      final unpaid = _job('unpaid', payment: PaymentStatus.pendingVerification);
      const here = GeoLocation(15.6, 32.5);
      expect(nextJob([unpaid, far, near], here)?.id, 'near');
      // No position: the oldest paid job.
      final old = _job('old', created: DateTime(2026, 1, 1));
      expect(nextJob([unpaid, far, old], null)?.id, 'old');
      // Only an unpaid job left: it is still the one to do next.
      expect(nextJob([unpaid], null)?.id, 'unpaid');
      expect(nextJob([_job('d', status: OrderStatus.completed)], null), isNull);
    });

    test('fees count completed jobs finished this month only', () {
      final now = DateTime(2026, 10, 15);
      final jobs = [
        _job('a', status: OrderStatus.completed, fee: 100, updated: DateTime(2026, 10, 3)),
        _job('b', status: OrderStatus.completed, fee: 50, updated: DateTime(2026, 9, 28)),
        _job('c', status: OrderStatus.processing, fee: 999),
        _job('d', status: OrderStatus.completed, fee: 25, updated: DateTime(2026, 10, 10)),
      ];
      expect(monthInstallationFees(jobs, now), 125);
    });

    test('a pickup order has no distance and no directions', () {
      final pickup = _job('p', method: DeliveryMethod.pickup, lat: 15.6, lng: 32.5);
      expect(jobHasDirections(pickup), isFalse);
      expect(jobDistanceKm(_job('x'), const GeoLocation(15.6, 32.5)), isNull);
    });
  });

  group('jobs tab', () {
    final jobs = [
      _job('open1', product: 'Router X'),
      _job('open2', product: 'Printer'),
      _job('done1', product: 'Switch', status: OrderStatus.completed),
      _job('gone1', product: 'Cable', status: OrderStatus.cancelled),
    ];

    testWidgets('groups open, completed and cancelled jobs', (tester) async {
      // Tall enough that the lazy list builds every row.
      tester.view.physicalSize = const Size(900, 3000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_app(
        const TechnicianJobsTab(technicianId: 't1'),
        overrides: [_jobs(jobs)],
      ));
      await tester.pumpAndSettle();

      expect(find.text('All 4'), findsOneWidget);
      expect(find.text('Open 2'), findsOneWidget);
      expect(find.text('Router X'), findsOneWidget);
      expect(find.text('Printer'), findsOneWidget);
      expect(find.text('Switch'), findsOneWidget);
      expect(find.text('Cable'), findsOneWidget);
    });

    testWidgets('a filter chip narrows the list', (tester) async {
      await tester.pumpWidget(_app(
        const TechnicianJobsTab(technicianId: 't1'),
        overrides: [_jobs(jobs)],
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Done 1'));
      await tester.pumpAndSettle();
      expect(find.text('Switch'), findsOneWidget);
      expect(find.text('Router X'), findsNothing);
    });

    testWidgets('search matches the product or the customer', (tester) async {
      await tester.pumpWidget(_app(
        const TechnicianJobsTab(technicianId: 't1'),
        overrides: [_jobs(jobs)],
      ));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'printer');
      await tester.pumpAndSettle();
      expect(find.text('Printer'), findsOneWidget);
      expect(find.text('Router X'), findsNothing);

      await tester.enterText(find.byType(TextField), 'nothing like this');
      await tester.pumpAndSettle();
      expect(find.text('No jobs match your search.'), findsOneWidget);
    });

    testWidgets('a job waiting for payment says so', (tester) async {
      await tester.pumpWidget(_app(
        const TechnicianJobsTab(technicianId: 't1'),
        overrides: [
          _jobs([_job('w', payment: PaymentStatus.pendingVerification)]),
        ],
      ));
      await tester.pumpAndSettle();
      expect(find.text('Waiting for payment confirmation'), findsOneWidget);
    });
  });

  group('searching the jobs', () {
    OrderEntity job(String id, String product, String customer,
            {String phone = '0911111111',
            String address = 'Street',
            OrderStatus status = OrderStatus.processing,
            PaymentStatus payment = PaymentStatus.confirmed}) =>
        _job(id, product: product, status: status, payment: payment).copyWith(
          customerName: customer,
          contactPhone: phone,
          deliveryAddress: address,
        );

    final jobs = [
      job('a1', 'Router Archer', 'Amna Hassan', phone: '0912345678', address: 'Riyadh street 60'),
      job('b2', 'IP Camera', 'Babiker', phone: '0999000111', address: 'Bahri'),
      job('c3', 'Printer', 'Camelia',
          status: OrderStatus.cancelled, address: 'Omdurman'),
      job('d4', 'Switch 24 port', 'Dawood',
          payment: PaymentStatus.pendingVerification),
    ];

    Future<void> open(WidgetTester tester) async {
      tester.view.physicalSize = const Size(900, 3000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_app(
        const TechnicianJobsTab(technicianId: 't1'),
        overrides: [_jobs(jobs)],
      ));
      await tester.pumpAndSettle();
    }

    Future<void> search(WidgetTester tester, String text) async {
      await tester.enterText(find.byType(TextField), text);
      await tester.pumpAndSettle();
    }

    testWidgets('finds a job by the customer phone in any form', (tester) async {
      await open(tester);
      await search(tester, '0912345');
      expect(find.byKey(const ValueKey('technician-search-count')), findsOneWidget);
      expect(find.text('1 results'), findsOneWidget);
      await search(tester, '912345678');
      expect(find.text('1 results'), findsOneWidget);
    });

    testWidgets('finds a job by its status in words', (tester) async {
      await open(tester);
      await search(tester, 'cancelled');
      expect(find.text('1 results'), findsOneWidget);
      await search(tester, 'waiting payment');
      expect(find.text('1 results'), findsOneWidget);
    });

    testWidgets('finds by address, customer, number and in Arabic', (tester) async {
      await open(tester);
      await search(tester, 'riyadh');
      expect(find.text('1 results'), findsOneWidget);
      await search(tester, 'babiker');
      expect(find.text('1 results'), findsOneWidget);
      await search(tester, 'a1');
      expect(find.text('1 results'), findsOneWidget);
      // "كاميرا" is the same word as "camera".
      await search(tester, 'كاميرا');
      expect(find.text('IP Camera'), findsOneWidget);
      expect(find.text('Printer'), findsNothing);
    });

    testWidgets('a typo is forgiven, and a wrong word offers the right one',
        (tester) async {
      await open(tester);
      await search(tester, 'pritner');
      expect(find.text('Printer'), findsOneWidget);

      await search(tester, 'camra');
      expect(find.text('IP Camera'), findsOneWidget);

      // Two letters wrong: nothing is found, the right word is offered.
      await search(tester, 'prntr');
      expect(find.text('No jobs match your search.'), findsOneWidget);
      expect(find.byKey(const ValueKey('technician-did-you-mean')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('technician-did-you-mean')));
      await tester.pumpAndSettle();
      expect(find.text('Printer'), findsOneWidget);
    });
  });

  group('dashboard', () {
    testWidgets('shows the next job, the counts and this month fees', (tester) async {
      final now = DateTime.now();
      await tester.pumpWidget(_app(
        const TechnicianDashboardTab(
          technicianId: 't1',
          technicianName: 'Ali',
          onSelectJobsTab: _noop,
        ),
        overrides: [
          _jobs([
            _job('a', product: 'Camera'),
            _job('b', status: OrderStatus.completed, fee: 250, updated: now),
          ]),
          technicianByUidProvider('t1').overrideWith(
            (_) => Stream.value(
              const Technician(
                id: 't1',
                companyId: 'co1',
                fullName: 'Ali',
                isAvailable: false,
              ),
            ),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('Next job'), findsOneWidget);
      expect(find.text('Camera'), findsWidgets);
      expect(find.text('Busy'), findsOneWidget);
      expect(find.text('250 SDG'), findsOneWidget);
      expect(find.text('You have 1 open jobs'), findsOneWidget);
    });
  });

  group('finishing a job', () {
    testWidgets('needs the three checks, then keeps the remark', (tester) async {
      tester.view.physicalSize = const Size(900, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      late _FakeActions actions;
      await tester.pumpWidget(_app(
        TechnicianJobStatusActions(
          order: _job('j1', status: OrderStatus.outForDelivery),
        ),
        overrides: [
          technicianActionsProvider.overrideWith((ref) {
            return actions = _FakeActions(ref);
          }),
        ],
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Mark Installation Completed'));
      await tester.pumpAndSettle();

      // Confirming with nothing ticked asks for the checks and goes no further.
      await tester.tap(find.byKey(const ValueKey('finish-confirm')));
      await tester.pumpAndSettle();
      expect(find.text('Tick all three steps before confirming.'), findsOneWidget);
      expect(actions.finished, isEmpty);

      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byKey(ValueKey('finish-check-$i')));
      }
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('finish-note')), 'Done, gave the warranty');
      await tester.tap(find.byKey(const ValueKey('finish-confirm')));
      await tester.pumpAndSettle();

      expect(actions.finished, ['j1']);
      expect(actions.notes, ['Done, gave the warranty']);
    });

    testWidgets('cancelling the sheet changes nothing', (tester) async {
      tester.view.physicalSize = const Size(900, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      late _FakeActions actions;
      await tester.pumpWidget(_app(
        TechnicianJobStatusActions(
          order: _job('j1', status: OrderStatus.outForDelivery),
        ),
        overrides: [
          technicianActionsProvider.overrideWith((ref) {
            return actions = _FakeActions(ref);
          }),
        ],
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Mark Installation Completed'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(actions.finished, isEmpty);
    });
  });

  test('a completion remark is its own kind of note', () {
    expect(TechnicianNoteKind.fromValue('completion'), TechnicianNoteKind.completion);
    expect(TechnicianNoteKind.fromValue('anything else'), TechnicianNoteKind.note);
    expect(TechnicianNote.maxLength, 500);
    // The provider the screens watch exists and is keyed by order.
    expect(technicianNotesProvider('o1'), isNotNull);
  });
}

void _noop() {}

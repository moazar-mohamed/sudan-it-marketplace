import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/companies/data/models/company_model.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/pickup_point.dart';

Company _company({
  String? pickupAddress,
  List<PickupPoint> pickupPoints = const [],
}) =>
    Company(
      id: 'c1',
      name: 'Company',
      rating: 0,
      reviewCount: 0,
      pickupAddress: pickupAddress,
      pickupPoints: pickupPoints,
    );

void main() {
  group('PickupPoint', () {
    test('label joins the name and the address, whichever are present', () {
      expect(const PickupPoint(name: 'Branch', address: 'Street 9').label,
          'Branch — Street 9');
      expect(const PickupPoint(name: 'Branch').label, 'Branch');
      expect(const PickupPoint(name: '', address: 'Street 9').label, 'Street 9');
    });

    test('round-trips through its map, keeping the map point', () {
      const point = PickupPoint(
        name: 'Branch',
        address: 'Street 9',
        latitude: 15.5,
        longitude: 32.5,
      );
      expect(PickupPoint.tryFromMap(point.toMap()), point);
      expect(const PickupPoint(name: 'A').toMap().containsKey('latitude'), isFalse);
    });

    test('an entry without a name is dropped', () {
      expect(PickupPoint.tryFromMap({'address': 'Street 9'}), isNull);
      expect(PickupPoint.tryFromMap('nope'), isNull);
    });
  });

  group('Company pickup points', () {
    test('none and no old address means the company location', () {
      expect(_company().effectivePickupPoints, isEmpty);
    });

    test('an old single address becomes one point', () {
      final points = _company(pickupAddress: ' Street 9 ').effectivePickupPoints;
      expect(points, hasLength(1));
      expect(points.single.label, 'Street 9');
    });

    test('chosen points win over the old address', () {
      final company = _company(
        pickupAddress: 'Old',
        pickupPoints: const [PickupPoint(name: 'Branch', address: 'New')],
      );
      expect(company.effectivePickupPoints.single.name, 'Branch');
    });

    test('the model reads at most five points and skips unusable ones', () {
      final company = CompanyModel.fromMap('c1', {
        'name': 'C',
        'pickupPoints': [
          for (var i = 0; i < 7; i++) {'name': 'P$i', 'address': 'A'},
        ],
      });
      expect(company.pickupPoints, hasLength(5));

      final withBad = CompanyModel.fromMap('c1', {
        'name': 'C',
        'pickupPoints': [
          {'address': 'no name'},
          {'name': 'Ok'},
        ],
      });
      expect(withBad.pickupPoints.map((p) => p.name), ['Ok']);
    });

    test('saving mirrors the first point into the written address', () {
      final fields = CompanyModel.toEditableFields(_company(
        pickupAddress: 'Old',
        pickupPoints: const [
          PickupPoint(name: 'Branch', address: 'Street 9'),
          PickupPoint(name: 'Warehouse'),
        ],
      ));
      expect(fields['pickupAddress'], 'Branch — Street 9');
      expect(fields['pickupPoints'], hasLength(2));
    });

    test('saving with no points clears the list and keeps the empty address', () {
      final fields = CompanyModel.toEditableFields(_company(pickupAddress: ''));
      expect(fields['pickupAddress'], '');
      expect(fields['pickupPoints'], isEmpty);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/cities/data/city_announcer.dart';
import 'package:sudan_it_marketplace/features/cities/domain/sudan_city.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_destination.dart';

void main() {
  tearDown(resetCityDirectory);

  group('the list Platform Admin keeps', () {
    test('is read from platform_settings/cities, hidden cities included', () {
      final cities = citiesFromDocument({
        'ids': ['atlantis', 'camelot'],
        'items': [
          {'id': 'atlantis', 'nameAr': 'أطلنطس', 'nameEn': 'Atlantis', 'latitude': 10, 'longitude': 20},
          {'id': 'camelot', 'nameAr': '', 'nameEn': 'Camelot', 'active': false},
          {'id': '', 'nameEn': 'No id'},
          {'id': 'nameless'},
          'junk',
          {'id': 'atlantis', 'nameEn': 'Again'},
        ],
      });
      expect(cities.map((c) => c.id), ['atlantis', 'camelot']);
      expect(cities[0].latitude, 10);
      expect(cities[1].nameAr, 'Camelot');
      expect(cities[1].active, isFalse);
      expect(cities[1].latitude, isNull);
    });

    test('a missing or empty document means the built-in list', () {
      expect(citiesFromDocument(null), same(builtInCities));
      expect(citiesFromDocument({'items': []}), same(builtInCities));
      expect(citiesFromDocument({'items': 'x'}), same(builtInCities));
    });

    test('once set, it is the list the app works with', () {
      setCityDirectory(citiesFromDocument({
        'items': [
          {'id': 'atlantis', 'nameAr': 'أطلنطس', 'nameEn': 'Atlantis', 'latitude': 15.5, 'longitude': 32.5},
          {'id': 'camelot', 'nameEn': 'Camelot', 'active': false},
        ],
      }));
      expect(cityById('atlantis')?.nameEn, 'Atlantis');
      expect(cityById('khartoum'), isNull);
      expect(sudanCities, hasLength(2));
      expect(activeCities.map((c) => c.id), ['atlantis']);
      expect(nearestCity(15.5, 32.5)?.id, 'atlantis');
      resetCityDirectory();
      expect(cityById('khartoum'), isNotNull);
    });

    test('a saved city this phone has not heard of is kept, not dropped', () {
      expect(normalizeCityIds(['khartoum', 'brand_new', 'khartoum', '', 3]), [
        'khartoum',
        'brand_new',
      ]);
    });

    test('a city without a position or a hidden one is never suggested', () {
      setCityDirectory(const [
        SudanCity('hidden', 'مخفية', 'Hidden', 15.5, 32.5, false),
        SudanCity('nowhere', 'بلا موقع', 'Nowhere'),
        SudanCity('far', 'بعيدة', 'Far', 20, 37),
      ]);
      expect(nearestCity(15.5, 32.5), isNull);
      expect(nearestCity(20, 37)?.id, 'far');
    });
  });

  test('the push topic of a city and language', () {
    expect(cityPushTopic('khartoum', 'ar'), 'city_khartoum_ar');
    expect(cityPushTopic('khartoum', 'en'), 'city_khartoum_en');
    expect(cityPushTopic('khartoum', 'fr'), 'city_khartoum_en');
  });

  group('announcing the cities a company just added', () {
    test('only the new ones are announced', () {
      expect(
        CityAnnouncer.addedCities(['khartoum'], ['khartoum', 'bahri', 'omdurman']),
        ['bahri', 'omdurman'],
      );
      expect(CityAnnouncer.addedCities(['khartoum'], []), isEmpty);
    });

    test('each one is written, then pushed only if it was created', () async {
      final written = <String>[];
      final pushed = <String>[];
      final announcer = CityAnnouncer(
        write: ({required companyId, required companyName, required cityId}) async {
          written.add(cityId);
          return cityId != 'already';
        },
        push: (id) async => pushed.add(id),
      );
      await announcer.announce(
        companyId: 'c1',
        companyName: 'Nile Tech',
        cityIds: ['khartoum', 'already', 'bahri'],
      );
      expect(written, ['khartoum', 'already', 'bahri']);
      expect(pushed, ['c1_khartoum', 'c1_bahri']);
    });

    test('a failure never stops the rest or reaches the caller', () async {
      final pushed = <String>[];
      final announcer = CityAnnouncer(
        write: ({required companyId, required companyName, required cityId}) async {
          if (cityId == 'bad') throw StateError('boom');
          return true;
        },
        push: (id) async => pushed.add(id),
      );
      await announcer.announce(
        companyId: 'c1',
        companyName: 'X',
        cityIds: ['bad', 'khartoum'],
      );
      expect(pushed, ['c1_khartoum']);
    });

    test('one save announces at most ten cities', () async {
      var count = 0;
      final announcer = CityAnnouncer(
        write: ({required companyId, required companyName, required cityId}) async {
          count++;
          return true;
        },
        push: (_) async {},
      );
      await announcer.announce(
        companyId: 'c1',
        companyName: 'X',
        cityIds: [for (final city in builtInCities) city.id],
      );
      expect(count, CityAnnouncer.maxPerSave);
    });
  });

  group('tapping the push', () {
    UserProfile profile(UserRole role) => UserProfile(
          id: 'u',
          fullName: 'U',
          email: 'u@x.test',
          role: role,
          createdAt: DateTime(2026),
          isActive: true,
        );

    test('a customer opens the company, anyone else gets no screen', () {
      final data = {'type': 'city_announcement', 'companyId': 'c1'};
      final destination = pushDestination(data, profile(UserRole.customer));
      expect(destination, isA<CompanyDestination>());
      expect((destination! as CompanyDestination).companyId, 'c1');
      expect(pushDestination(data, profile(UserRole.companyAdmin)), isNull);
      expect(
        pushDestination({'type': 'city_announcement'}, profile(UserRole.customer)),
        isNull,
      );
    });
  });
}

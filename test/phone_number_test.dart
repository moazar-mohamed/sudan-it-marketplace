import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/constants/phone_countries.dart';
import 'package:sudan_it_marketplace/core/utils/phone_number.dart';
import 'package:sudan_it_marketplace/core/widgets/phone_country_sheet.dart';

PhoneCountry _country(String iso) => PhoneCountries.byIso(iso)!;

void main() {
  group('country list', () {
    test('every country has a unique ISO code and a digits-only code', () {
      final isoCodes = <String>{};
      for (final country in PhoneCountries.all) {
        expect(isoCodes.add(country.isoCode), isTrue,
            reason: 'duplicate ${country.isoCode}');
        expect(country.isoCode, matches(RegExp(r'^[A-Z]{2}$')));
        expect(country.dialCode, matches(RegExp(r'^[1-9][0-9]{0,3}$')));
        expect(country.nameEn, isNotEmpty);
        expect(country.nameAr, isNotEmpty);
        expect(country.minLength, lessThanOrEqualTo(country.maxLength));
        expect(country.dialCode.length + country.maxLength,
            lessThanOrEqualTo(15),
            reason: '${country.isoCode} is longer than E.164 allows');
      }
    });

    test('Sudan is the default and first of the most used', () {
      expect(PhoneCountries.sudan.isoCode, 'SD');
      expect(PhoneCountries.sudan.plusCode, '+249');
      expect(PhoneCountries.common.first, 'SD');
      for (final iso in PhoneCountries.common) {
        expect(PhoneCountries.byIso(iso), isNotNull, reason: iso);
      }
    });

    test('a shared code belongs to its main country', () {
      expect(PhoneNumber.byDialCode('1')!.isoCode, 'US');
      expect(PhoneNumber.byDialCode('7')!.isoCode, 'RU');
      expect(PhoneNumber.byDialCode('249')!.isoCode, 'SD');
      expect(PhoneNumber.byDialCode('999'), isNull);
    });

    test('the flag is built from the ISO code', () {
      expect(PhoneCountries.sudan.flag, '🇸🇩');
      expect(_country('SA').flag, '🇸🇦');
    });
  });

  group('PhoneNumber.parse', () {
    test('a saved international number is split on its code', () {
      final sudan = PhoneNumber.parse('+249912345678');
      expect(sudan.country.isoCode, 'SD');
      expect(sudan.national, '912345678');
      expect(sudan.e164, '+249912345678');

      final saudi = PhoneNumber.parse('+966 50 123 4567');
      expect(saudi.country.isoCode, 'SA');
      expect(saudi.national, '501234567');

      final egypt = PhoneNumber.parse('0020 10 1234 5678');
      expect(egypt.country.isoCode, 'EG');
      expect(egypt.national, '1012345678');
    });

    test('the longest code wins (Jamaica, not the United States)', () {
      final jamaica = PhoneNumber.parse('+18765551234');
      expect(jamaica.country.isoCode, 'JM');
      expect(jamaica.national, '5551234');
      expect(PhoneNumber.parse('+12025550123').country.isoCode, 'US');
    });

    test('numbers saved before the code was asked for are Sudanese', () {
      for (final old in ['0912345678', '912345678', '249912345678',
          '0912 345 678']) {
        final number = PhoneNumber.parse(old);
        expect(number.country.isoCode, 'SD', reason: old);
        expect(number.national, '912345678', reason: old);
        expect(number.e164, '+249912345678', reason: old);
      }
    });

    test('empty stays empty', () {
      expect(PhoneNumber.parse(null).isEmpty, isTrue);
      expect(PhoneNumber.parse('  ').e164, '');
      expect(PhoneNumber.parse('').country.isoCode, 'SD');
    });

    test('the trunk 0 is dropped, except where it is part of the number', () {
      expect(PhoneNumber.cleanNational('0912 345 678', PhoneCountries.sudan),
          '912345678');
      expect(PhoneNumber.cleanNational('06 1234 5678', _country('IT')),
          '0612345678');
      expect(PhoneNumber.parse('+390612345678').national, '0612345678');
    });
  });

  group('length rules', () {
    test('a Sudanese number has exactly 9 digits after +249', () {
      expect(PhoneNumber(PhoneCountries.sudan, '912345678').hasValidLength,
          isTrue);
      expect(PhoneNumber(PhoneCountries.sudan, '91234567').hasValidLength,
          isFalse);
      expect(PhoneNumber(PhoneCountries.sudan, '9123456789').hasValidLength,
          isFalse);
    });

    test('ranges and defaults', () {
      expect(PhoneNumber(_country('AE'), '41234567').hasValidLength, isTrue);
      expect(PhoneNumber(_country('AE'), '501234567').hasValidLength, isTrue);
      expect(PhoneNumber(_country('DE'), '30123456').hasValidLength, isTrue);
      expect(PhoneNumber(_country('DE'), '12345').hasValidLength, isFalse);
    });
  });

  group('showing and searching saved numbers', () {
    test('a space separates the code', () {
      expect(displayPhone('+249912345678'), '+249 912345678');
      expect(displayPhone('+966501234567'), '+966 501234567');
    });

    test('an old number is shown as it was typed', () {
      expect(displayPhone('0912345678'), '0912345678');
      expect(displayPhone(null), '');
    });

    test('the local form is searchable too', () {
      expect(phoneSearchForms('+249912345678'),
          containsAll(['+249912345678', '0912345678']));
      expect(phoneSearchForms('0912345678'), contains('0912345678'));
      expect(phoneSearchForms(''), isEmpty);
    });
  });

  group('country search', () {
    test('by Arabic or English name, ISO code or dialling code', () {
      List<String> iso(String query, [String lang = 'ar']) =>
          [for (final c in searchPhoneCountries(query, lang)) c.isoCode];

      expect(iso('السودان'), containsAll(['SD', 'SS']));
      expect(iso('سعوديه'), ['SA']); // ة and ه are the same when searching
      expect(iso('saudi', 'en'), ['SA']);
      expect(iso('+249'), ['SD']);
      expect(iso('966'), ['SA']);
      expect(iso('sd'), contains('SD'));
      expect(iso('zzzz'), isEmpty);
    });

    test('the whole list is in alphabetical order of the shown language', () {
      final english = searchPhoneCountries('', 'en');
      expect(english.first.nameEn, 'Afghanistan');
      expect(english, hasLength(PhoneCountries.all.length));
    });
  });

  test('every phone input in the app uses PhoneField', () {
    // A plain text field for a phone would skip the country code again.
    final offenders = [
      for (final file in Directory('lib').listSync(recursive: true))
        if (file is File &&
            file.path.endsWith('.dart') &&
            !file.path.replaceAll(r'\', '/').endsWith('widgets/phone_field.dart') &&
            file.readAsStringSync().contains('TextInputType.phone'))
          file.path,
    ];
    expect(offenders, isEmpty);
  });
}

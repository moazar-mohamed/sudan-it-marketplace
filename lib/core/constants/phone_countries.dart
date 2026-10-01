/// A country a phone number can belong to: its ISO 3166 code, its
/// international dialling code (the "key", without the `+`) and its name.
///
/// [minLength] and [maxLength] bound the national number, the digits typed
/// after the dialling code. Countries whose plan is known get exact bounds;
/// the others accept anything E.164 allows (at most 15 digits in all).
class PhoneCountry {
  const PhoneCountry(
    this.isoCode,
    this.dialCode,
    this.nameEn,
    this.nameAr, {
    this.minLength = 6,
    int? maxLength,
    this.keepsLeadingZero = false,
    this.sharesCode = false,
    this.example,
  }) : maxLength = maxLength ?? 15 - dialCode.length;

  final String isoCode;
  final String dialCode;
  final String nameEn;
  final String nameAr;
  final int minLength;
  final int maxLength;

  /// The national number really starts with 0 (Italy, Côte d'Ivoire...), so a
  /// typed leading 0 is part of the number, not the local trunk prefix.
  final bool keepsLeadingZero;

  /// Another country with the same dialling code comes first when a stored
  /// number is read back (+1 is the United States, not Canada).
  final bool sharesCode;

  /// A sample national number shown as the field's hint.
  final String? example;

  /// `+249`.
  String get plusCode => '+$dialCode';

  /// The flag emoji, built from the two regional-indicator letters.
  String get flag => String.fromCharCodes([
        for (final unit in isoCode.codeUnits) 0x1F1E6 + unit - 0x41,
      ]);

  String name(String languageCode) => languageCode == 'ar' ? nameAr : nameEn;

  @override
  bool operator ==(Object other) =>
      other is PhoneCountry && other.isoCode == isoCode;

  @override
  int get hashCode => isoCode.hashCode;
}

/// Every country the phone field offers.
abstract final class PhoneCountries {
  /// The default: the marketplace is in Sudan.
  static const sudan = PhoneCountry(
    'SD', '249', 'Sudan', 'السودان',
    minLength: 9, maxLength: 9, example: '91 234 5678',
  );

  /// Shown first in the chooser: Sudan and where most Sudanese abroad live.
  static const common = ['SD', 'SA', 'EG', 'AE', 'QA', 'SS'];

  static PhoneCountry? byIso(String isoCode) {
    for (final country in all) {
      if (country.isoCode == isoCode) return country;
    }
    return null;
  }

  static const all = <PhoneCountry>[
    sudan,
    PhoneCountry('AF', '93', 'Afghanistan', 'أفغانستان'),
    PhoneCountry('AL', '355', 'Albania', 'ألبانيا'),
    PhoneCountry('DZ', '213', 'Algeria', 'الجزائر', minLength: 8, maxLength: 9),
    PhoneCountry('AD', '376', 'Andorra', 'أندورا'),
    PhoneCountry('AO', '244', 'Angola', 'أنغولا'),
    PhoneCountry('AG', '1268', 'Antigua and Barbuda', 'أنتيغوا وبربودا', minLength: 7, maxLength: 7),
    PhoneCountry('AR', '54', 'Argentina', 'الأرجنتين'),
    PhoneCountry('AM', '374', 'Armenia', 'أرمينيا'),
    PhoneCountry('AU', '61', 'Australia', 'أستراليا'),
    PhoneCountry('AT', '43', 'Austria', 'النمسا'),
    PhoneCountry('AZ', '994', 'Azerbaijan', 'أذربيجان'),
    PhoneCountry('BS', '1242', 'Bahamas', 'جزر البهاما', minLength: 7, maxLength: 7),
    PhoneCountry('BH', '973', 'Bahrain', 'البحرين', minLength: 8, maxLength: 8),
    PhoneCountry('BD', '880', 'Bangladesh', 'بنغلاديش'),
    PhoneCountry('BB', '1246', 'Barbados', 'باربادوس', minLength: 7, maxLength: 7),
    PhoneCountry('BY', '375', 'Belarus', 'بيلاروسيا'),
    PhoneCountry('BE', '32', 'Belgium', 'بلجيكا'),
    PhoneCountry('BZ', '501', 'Belize', 'بليز'),
    PhoneCountry('BJ', '229', 'Benin', 'بنين'),
    PhoneCountry('BT', '975', 'Bhutan', 'بوتان'),
    PhoneCountry('BO', '591', 'Bolivia', 'بوليفيا'),
    PhoneCountry('BA', '387', 'Bosnia and Herzegovina', 'البوسنة والهرسك'),
    PhoneCountry('BW', '267', 'Botswana', 'بوتسوانا'),
    PhoneCountry('BR', '55', 'Brazil', 'البرازيل'),
    PhoneCountry('BN', '673', 'Brunei', 'بروناي'),
    PhoneCountry('BG', '359', 'Bulgaria', 'بلغاريا'),
    PhoneCountry('BF', '226', 'Burkina Faso', 'بوركينا فاسو'),
    PhoneCountry('BI', '257', 'Burundi', 'بوروندي'),
    PhoneCountry('CV', '238', 'Cape Verde', 'الرأس الأخضر'),
    PhoneCountry('KH', '855', 'Cambodia', 'كمبوديا'),
    PhoneCountry('CM', '237', 'Cameroon', 'الكاميرون'),
    PhoneCountry('CA', '1', 'Canada', 'كندا', minLength: 10, maxLength: 10, sharesCode: true),
    PhoneCountry('CF', '236', 'Central African Republic', 'جمهورية أفريقيا الوسطى', minLength: 8, maxLength: 8),
    PhoneCountry('TD', '235', 'Chad', 'تشاد', minLength: 8, maxLength: 8),
    PhoneCountry('CL', '56', 'Chile', 'تشيلي'),
    PhoneCountry('CN', '86', 'China', 'الصين'),
    PhoneCountry('CO', '57', 'Colombia', 'كولومبيا'),
    PhoneCountry('KM', '269', 'Comoros', 'جزر القمر', minLength: 7, maxLength: 7),
    PhoneCountry('CG', '242', 'Congo', 'الكونغو', keepsLeadingZero: true),
    PhoneCountry('CD', '243', 'DR Congo', 'الكونغو الديمقراطية'),
    PhoneCountry('CR', '506', 'Costa Rica', 'كوستاريكا'),
    PhoneCountry('CI', '225', "Côte d'Ivoire", 'ساحل العاج', keepsLeadingZero: true),
    PhoneCountry('HR', '385', 'Croatia', 'كرواتيا'),
    PhoneCountry('CU', '53', 'Cuba', 'كوبا'),
    PhoneCountry('CY', '357', 'Cyprus', 'قبرص'),
    PhoneCountry('CZ', '420', 'Czechia', 'التشيك'),
    PhoneCountry('DK', '45', 'Denmark', 'الدنمارك'),
    PhoneCountry('DJ', '253', 'Djibouti', 'جيبوتي', minLength: 8, maxLength: 8),
    PhoneCountry('DM', '1767', 'Dominica', 'دومينيكا', minLength: 7, maxLength: 7),
    PhoneCountry('DO', '1809', 'Dominican Republic', 'جمهورية الدومينيكان', minLength: 7, maxLength: 7),
    PhoneCountry('EC', '593', 'Ecuador', 'الإكوادور'),
    PhoneCountry('EG', '20', 'Egypt', 'مصر', minLength: 8, maxLength: 10, example: '10 1234 5678'),
    PhoneCountry('SV', '503', 'El Salvador', 'السلفادور'),
    PhoneCountry('GQ', '240', 'Equatorial Guinea', 'غينيا الاستوائية'),
    PhoneCountry('ER', '291', 'Eritrea', 'إريتريا', minLength: 7, maxLength: 7),
    PhoneCountry('EE', '372', 'Estonia', 'إستونيا'),
    PhoneCountry('SZ', '268', 'Eswatini', 'إسواتيني'),
    PhoneCountry('ET', '251', 'Ethiopia', 'إثيوبيا', minLength: 9, maxLength: 9),
    PhoneCountry('FJ', '679', 'Fiji', 'فيجي'),
    PhoneCountry('FI', '358', 'Finland', 'فنلندا'),
    PhoneCountry('FR', '33', 'France', 'فرنسا', minLength: 9, maxLength: 9),
    PhoneCountry('GA', '241', 'Gabon', 'الغابون', keepsLeadingZero: true),
    PhoneCountry('GM', '220', 'Gambia', 'غامبيا'),
    PhoneCountry('GE', '995', 'Georgia', 'جورجيا'),
    PhoneCountry('DE', '49', 'Germany', 'ألمانيا'),
    PhoneCountry('GH', '233', 'Ghana', 'غانا'),
    PhoneCountry('GR', '30', 'Greece', 'اليونان'),
    PhoneCountry('GD', '1473', 'Grenada', 'غرينادا', minLength: 7, maxLength: 7),
    PhoneCountry('GT', '502', 'Guatemala', 'غواتيمالا'),
    PhoneCountry('GN', '224', 'Guinea', 'غينيا'),
    PhoneCountry('GW', '245', 'Guinea-Bissau', 'غينيا بيساو'),
    PhoneCountry('GY', '592', 'Guyana', 'غيانا'),
    PhoneCountry('HT', '509', 'Haiti', 'هايتي'),
    PhoneCountry('HN', '504', 'Honduras', 'هندوراس'),
    PhoneCountry('HK', '852', 'Hong Kong', 'هونغ كونغ'),
    PhoneCountry('HU', '36', 'Hungary', 'المجر'),
    PhoneCountry('IS', '354', 'Iceland', 'آيسلندا'),
    PhoneCountry('IN', '91', 'India', 'الهند', minLength: 10, maxLength: 10),
    PhoneCountry('ID', '62', 'Indonesia', 'إندونيسيا'),
    PhoneCountry('IR', '98', 'Iran', 'إيران'),
    PhoneCountry('IQ', '964', 'Iraq', 'العراق', minLength: 8, maxLength: 10),
    PhoneCountry('IE', '353', 'Ireland', 'أيرلندا'),
    PhoneCountry('IT', '39', 'Italy', 'إيطاليا', keepsLeadingZero: true),
    PhoneCountry('JM', '1876', 'Jamaica', 'جامايكا', minLength: 7, maxLength: 7),
    PhoneCountry('JP', '81', 'Japan', 'اليابان'),
    PhoneCountry('JO', '962', 'Jordan', 'الأردن', minLength: 8, maxLength: 9),
    PhoneCountry('KZ', '7', 'Kazakhstan', 'كازاخستان', minLength: 10, maxLength: 10, sharesCode: true),
    PhoneCountry('KE', '254', 'Kenya', 'كينيا', minLength: 9, maxLength: 9),
    PhoneCountry('KI', '686', 'Kiribati', 'كيريباتي', minLength: 5),
    PhoneCountry('KW', '965', 'Kuwait', 'الكويت', minLength: 8, maxLength: 8),
    PhoneCountry('KG', '996', 'Kyrgyzstan', 'قيرغيزستان'),
    PhoneCountry('LA', '856', 'Laos', 'لاوس'),
    PhoneCountry('LV', '371', 'Latvia', 'لاتفيا'),
    PhoneCountry('LB', '961', 'Lebanon', 'لبنان', minLength: 7, maxLength: 8),
    PhoneCountry('LS', '266', 'Lesotho', 'ليسوتو'),
    PhoneCountry('LR', '231', 'Liberia', 'ليبيريا'),
    PhoneCountry('LY', '218', 'Libya', 'ليبيا', minLength: 8, maxLength: 9),
    PhoneCountry('LI', '423', 'Liechtenstein', 'ليختنشتاين'),
    PhoneCountry('LT', '370', 'Lithuania', 'ليتوانيا'),
    PhoneCountry('LU', '352', 'Luxembourg', 'لوكسمبورغ', minLength: 4),
    PhoneCountry('MO', '853', 'Macau', 'ماكاو'),
    PhoneCountry('MG', '261', 'Madagascar', 'مدغشقر'),
    PhoneCountry('MW', '265', 'Malawi', 'ملاوي'),
    PhoneCountry('MY', '60', 'Malaysia', 'ماليزيا'),
    PhoneCountry('MV', '960', 'Maldives', 'جزر المالديف'),
    PhoneCountry('ML', '223', 'Mali', 'مالي'),
    PhoneCountry('MT', '356', 'Malta', 'مالطا'),
    PhoneCountry('MH', '692', 'Marshall Islands', 'جزر مارشال'),
    PhoneCountry('MR', '222', 'Mauritania', 'موريتانيا', minLength: 8, maxLength: 8),
    PhoneCountry('MU', '230', 'Mauritius', 'موريشيوس'),
    PhoneCountry('MX', '52', 'Mexico', 'المكسيك'),
    PhoneCountry('FM', '691', 'Micronesia', 'ميكرونيزيا'),
    PhoneCountry('MD', '373', 'Moldova', 'مولدوفا'),
    PhoneCountry('MC', '377', 'Monaco', 'موناكو'),
    PhoneCountry('MN', '976', 'Mongolia', 'منغوليا'),
    PhoneCountry('ME', '382', 'Montenegro', 'الجبل الأسود'),
    PhoneCountry('MA', '212', 'Morocco', 'المغرب', minLength: 9, maxLength: 9),
    PhoneCountry('MZ', '258', 'Mozambique', 'موزمبيق'),
    PhoneCountry('MM', '95', 'Myanmar', 'ميانمار'),
    PhoneCountry('NA', '264', 'Namibia', 'ناميبيا'),
    PhoneCountry('NR', '674', 'Nauru', 'ناورو'),
    PhoneCountry('NP', '977', 'Nepal', 'نيبال'),
    PhoneCountry('NL', '31', 'Netherlands', 'هولندا'),
    PhoneCountry('NZ', '64', 'New Zealand', 'نيوزيلندا'),
    PhoneCountry('NI', '505', 'Nicaragua', 'نيكاراغوا'),
    PhoneCountry('NE', '227', 'Niger', 'النيجر'),
    PhoneCountry('NG', '234', 'Nigeria', 'نيجيريا'),
    PhoneCountry('KP', '850', 'North Korea', 'كوريا الشمالية'),
    PhoneCountry('MK', '389', 'North Macedonia', 'مقدونيا الشمالية'),
    PhoneCountry('NO', '47', 'Norway', 'النرويج'),
    PhoneCountry('OM', '968', 'Oman', 'عُمان', minLength: 8, maxLength: 8),
    PhoneCountry('PK', '92', 'Pakistan', 'باكستان'),
    PhoneCountry('PW', '680', 'Palau', 'بالاو'),
    PhoneCountry('PS', '970', 'Palestine', 'فلسطين', minLength: 8, maxLength: 9),
    PhoneCountry('PA', '507', 'Panama', 'بنما'),
    PhoneCountry('PG', '675', 'Papua New Guinea', 'بابوا غينيا الجديدة'),
    PhoneCountry('PY', '595', 'Paraguay', 'باراغواي'),
    PhoneCountry('PE', '51', 'Peru', 'بيرو'),
    PhoneCountry('PH', '63', 'Philippines', 'الفلبين'),
    PhoneCountry('PL', '48', 'Poland', 'بولندا'),
    PhoneCountry('PT', '351', 'Portugal', 'البرتغال'),
    PhoneCountry('PR', '1787', 'Puerto Rico', 'بورتوريكو', minLength: 7, maxLength: 7),
    PhoneCountry('QA', '974', 'Qatar', 'قطر', minLength: 7, maxLength: 8),
    PhoneCountry('RO', '40', 'Romania', 'رومانيا'),
    PhoneCountry('RU', '7', 'Russia', 'روسيا', minLength: 10, maxLength: 10),
    PhoneCountry('RW', '250', 'Rwanda', 'رواندا'),
    PhoneCountry('KN', '1869', 'Saint Kitts and Nevis', 'سانت كيتس ونيفيس', minLength: 7, maxLength: 7),
    PhoneCountry('LC', '1758', 'Saint Lucia', 'سانت لوسيا', minLength: 7, maxLength: 7),
    PhoneCountry('VC', '1784', 'Saint Vincent and the Grenadines', 'سانت فنسنت والغرينادين', minLength: 7, maxLength: 7),
    PhoneCountry('WS', '685', 'Samoa', 'ساموا', minLength: 5),
    PhoneCountry('SM', '378', 'San Marino', 'سان مارينو', keepsLeadingZero: true),
    PhoneCountry('ST', '239', 'São Tomé and Príncipe', 'ساو تومي وبرينسيب'),
    PhoneCountry('SA', '966', 'Saudi Arabia', 'السعودية', minLength: 8, maxLength: 10, example: '50 123 4567'),
    PhoneCountry('SN', '221', 'Senegal', 'السنغال'),
    PhoneCountry('RS', '381', 'Serbia', 'صربيا'),
    PhoneCountry('SC', '248', 'Seychelles', 'سيشل'),
    PhoneCountry('SL', '232', 'Sierra Leone', 'سيراليون'),
    PhoneCountry('SG', '65', 'Singapore', 'سنغافورة', minLength: 8, maxLength: 8),
    PhoneCountry('SK', '421', 'Slovakia', 'سلوفاكيا'),
    PhoneCountry('SI', '386', 'Slovenia', 'سلوفينيا'),
    PhoneCountry('SB', '677', 'Solomon Islands', 'جزر سليمان', minLength: 5),
    PhoneCountry('SO', '252', 'Somalia', 'الصومال', minLength: 7, maxLength: 9),
    PhoneCountry('ZA', '27', 'South Africa', 'جنوب أفريقيا', minLength: 9, maxLength: 9),
    PhoneCountry('KR', '82', 'South Korea', 'كوريا الجنوبية'),
    PhoneCountry('SS', '211', 'South Sudan', 'جنوب السودان', minLength: 9, maxLength: 9),
    PhoneCountry('ES', '34', 'Spain', 'إسبانيا', minLength: 9, maxLength: 9),
    PhoneCountry('LK', '94', 'Sri Lanka', 'سريلانكا'),
    PhoneCountry('SR', '597', 'Suriname', 'سورينام'),
    PhoneCountry('SE', '46', 'Sweden', 'السويد'),
    PhoneCountry('CH', '41', 'Switzerland', 'سويسرا'),
    PhoneCountry('SY', '963', 'Syria', 'سوريا', minLength: 8, maxLength: 9),
    PhoneCountry('TW', '886', 'Taiwan', 'تايوان'),
    PhoneCountry('TJ', '992', 'Tajikistan', 'طاجيكستان'),
    PhoneCountry('TZ', '255', 'Tanzania', 'تنزانيا'),
    PhoneCountry('TH', '66', 'Thailand', 'تايلاند'),
    PhoneCountry('TL', '670', 'Timor-Leste', 'تيمور الشرقية'),
    PhoneCountry('TG', '228', 'Togo', 'توغو'),
    PhoneCountry('TO', '676', 'Tonga', 'تونغا', minLength: 5),
    PhoneCountry('TT', '1868', 'Trinidad and Tobago', 'ترينيداد وتوباغو', minLength: 7, maxLength: 7),
    PhoneCountry('TN', '216', 'Tunisia', 'تونس', minLength: 8, maxLength: 8),
    PhoneCountry('TR', '90', 'Türkiye', 'تركيا', minLength: 10, maxLength: 10),
    PhoneCountry('TM', '993', 'Turkmenistan', 'تركمانستان'),
    PhoneCountry('TV', '688', 'Tuvalu', 'توفالو', minLength: 5),
    PhoneCountry('UG', '256', 'Uganda', 'أوغندا', minLength: 9, maxLength: 9),
    PhoneCountry('UA', '380', 'Ukraine', 'أوكرانيا'),
    PhoneCountry('AE', '971', 'United Arab Emirates', 'الإمارات', minLength: 8, maxLength: 9, example: '50 123 4567'),
    PhoneCountry('GB', '44', 'United Kingdom', 'المملكة المتحدة', minLength: 7, maxLength: 10),
    PhoneCountry('US', '1', 'United States', 'الولايات المتحدة', minLength: 10, maxLength: 10),
    PhoneCountry('UY', '598', 'Uruguay', 'الأوروغواي'),
    PhoneCountry('UZ', '998', 'Uzbekistan', 'أوزبكستان'),
    PhoneCountry('VU', '678', 'Vanuatu', 'فانواتو', minLength: 5),
    PhoneCountry('VE', '58', 'Venezuela', 'فنزويلا'),
    PhoneCountry('VN', '84', 'Vietnam', 'فيتنام'),
    PhoneCountry('YE', '967', 'Yemen', 'اليمن', minLength: 7, maxLength: 9),
    PhoneCountry('ZM', '260', 'Zambia', 'زامبيا'),
    PhoneCountry('ZW', '263', 'Zimbabwe', 'زيمبابوي'),
  ];
}

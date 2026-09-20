# Sudan ICT Marketplace & Support App

A Flutter application connecting customers with IT service companies and technicians across Sudan, covering service requests, orders, and company management. Built with a feature-based Clean Architecture, Riverpod for state management, and Firebase as the backend.

## Roles

- `customer`
- `company_admin`
- `technician`
- `platform_admin`

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

## Localization (English / العربية)

Both apps (the Flutter app and the Platform Admin web app in `platform_admin_web/`) are fully translated into English (`en`) and Arabic (`ar`). Arabic switches the whole layout to right-to-left.

- **Flutter**: texts live in `lib/l10n/app_en.arb` (template) and `lib/l10n/app_ar.arb`. Use `context.l10n.someKey` in widgets. Keys are camelCase because ARB keys cannot contain dots (`commonCancel` = `common.cancel`). After editing an ARB file run `flutter gen-l10n`; the generated `lib/l10n/app_localizations*.dart` files are committed.
- **Platform Admin**: texts live in `platform_admin_web/src/i18n/dictionary.ts` (`en` and `ar`, checked by TypeScript). Use `useI18n().t('key')`.
- **Choosing the language**: on the login/register screens, and in Settings (the gear icon) once signed in. The choice applies at once with no restart. It is remembered on the device (Flutter: SharedPreferences key `language`; web: localStorage) and saved to `users/{uid}.language` (`"en"` or `"ar"`). A language stored on the profile wins at sign-in; users without one keep their device choice (English if none).
- **Not translated on purpose**: data stored in Firebase (company, product, customer and technician names, emails, phone numbers, order ids). Only UI text and system-generated messages are translated. Notifications are stored in English and shown in the reader's language from their type.
- **Errors**: the data layer throws codes (`AuthException.code`, `AppException`, `StockUnavailableException.issue`); the UI turns them into text in the current language.

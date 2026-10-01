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

## Notifications

Two kinds, both written to Firestore (`notifications`) by the app when something happens:

| Event | Who is told |
|---|---|
| New order | the company's admins |
| Payment confirmed, out for delivery, completed | the customer |
| Technician assigned | the technician |
| New rating / the company's reply | the company / the customer |
| New service request, or the customer cancels it | the company's admins |
| Service request accepted, declined, started, completed | the customer |
| Chat message (including a Contact question) | the other side of the conversation |

- **In the app**: every notification except chat messages shows in the Notifications list and opens the order or service request it is about. Chat messages have their own conversation list. Notifications are stored in English and shown in the reader's language from their `type` (see Localization).
- **On the phone**: the same events are pushed to the recipients' phones (FCM), even with the app closed, in their language. Tapping one opens the order, request or conversation (a technician's job just opens the app).

### How phone pushes work

The Firebase Spark plan has no Cloud Functions, so a small relay (`push_relay/`, a Cloudflare Worker) sends them. Right after the app writes a notification or a chat message it asks the relay to push it. The relay never sends text it was handed: it reads the item back from Firestore and only sends it if the caller is signed in, is the one who wrote it, it is under 10 minutes old and it was not pushed before (`push_log`, closed to the app by the rules).

Each phone is saved on `users/{uid}.fcmTokens` (the newest five). Signing out drops the phone's registration; tokens FCM reports as gone are removed by the relay.

Pushes are **off until the app is built with the relay's address**, so a plain build behaves as before (in-app notifications only). Android only for now: iOS also needs an APNs key and `GoogleService-Info.plist`, which are not set up.

### Setting it up

1. **Firestore rules first.** Deploy them before releasing an app version that sends notifications, otherwise the writes are rejected: `firebase deploy --only firestore:rules`.
2. **Firebase project.** Make sure the Firebase Cloud Messaging API (V1) is enabled, then create a service account key (Project settings → Service accounts → Generate new private key). Keep the file out of git (`*-firebase-adminsdk-*.json` is ignored).
3. **Deploy the relay**, from `push_relay/`:
   ```
   npm install
   npx wrangler login
   npx wrangler secret put SERVICE_ACCOUNT_JSON   # paste the whole key file
   npx wrangler deploy
   ```
   Redeploy with `npx wrangler deploy` whenever `push_relay/src/` changes (for example new notification texts).
4. **Build the app with the relay's address** (printed by `wrangler deploy`):
   ```
   flutter build apk --dart-define=PUSH_RELAY_URL=https://sudan-it-push.<account>.workers.dev
   ```
5. **Try it on a phone**: sign in on two devices, place an order or send a service request on one and check the other.

### Tests

- App: `flutter test`
- Relay: `cd push_relay && npm test`
- Security rules (needs the Firebase emulators): `cd platform_admin_web && npm run test:rules`

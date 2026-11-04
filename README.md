# Sudan ICT Marketplace

A marketplace that connects customers in Sudan with IT companies and their technicians. Customers buy IT products, request services (network setup, CCTV installation, maintenance and so on), pay by bank transfer, follow their orders and rate what they received. Companies run their catalogue, orders, offers and team, and the platform team manages companies, customers and categories.

It has four front ends on one Firebase project (Authentication and Cloud Firestore):

- a **Flutter app** (Android) for customers, company admins and technicians,
- a **customer website** (`customer_web`), the same marketplace in the browser, with public catalog pages that search engines can read,
- a **company panel** (`company_web`) where company admins manage the shop from a computer,
- a **Platform Admin dashboard** (`platform_admin_web`) for the platform team.

All of them are bilingual (Arabic and English, right-to-left in Arabic) and have light and dark themes.

## What is in this repository

| Path | What it is |
| --- | --- |
| `lib/` | The Flutter app for customers, company admins and technicians |
| `test/` | Flutter unit and widget tests |
| `customer_web/` | The customer website (React, TypeScript, Vite), and `scripts/seo/`, the generator of the public catalog pages |
| `company_web/` | The company panel (React, TypeScript, Vite) |
| `platform_admin_web/` | The Platform Admin dashboard (React, TypeScript, Vite), with the Firestore rules tests in `rules-tests/`. See its [README](platform_admin_web/README.md) |
| `push_relay/` | A small Cloudflare Worker that sends push notifications through Firebase Cloud Messaging |
| `firestore.rules` | The Firestore security rules: the real access control for every role |
| `firebase.json`, `firebase.customer.json`, `firebase.company.json` | Firebase Hosting, one site each: the admin dashboard (and the emulators), the customer website, the company panel |
| `docs/` | Design notes: [category trees](docs/categories.md), [payment receipts](docs/receipts.md), [the company panel](docs/company-web-plan.md), [the customer website](docs/customer-web-plan.md) and the [admin redesign plan](docs/admin-redesign-plan.md) |
| `AI_RULES.md` | Development rules for AI coding assistants working on this project |

## Roles and features

Customers use the mobile app or the customer website. Company admins use the mobile app or the company panel. Technicians use the mobile app. Platform Admin uses the web dashboard.

### Customer

- Sign up with email and password, or continue with Google.
- Browse products and services through one shared tree of categories, and see the companies on the marketplace. Choose a city: companies that serve it are shown first, and nothing is hidden because of the city.
- Search products, services and companies from a full search screen (on the website, also with Ctrl+K).
- See featured offers on products and services, with the discount, the old price and when the offer ends.
- See every picture a company added to a product (swipe in the app, thumbnails on the website), and save products and services as favorites.
- Order a product with delivery (typed address or a point on the map) or pickup, with optional installation by a technician. Ordering needs a verified e-mail address, and allows at most 10 orders in any 24 hours.
- Pay by bank transfer to one of the company's accounts and attach the transfer receipt, which every order needs. The receipt does not confirm the payment, and the product is not reserved until the company confirms the payment (see [Orders, payment and stock](#orders-payment-and-stock)).
- Send a service request to a company that offers the service.
- Follow orders and service requests step by step, and chat with the company about any of them. A Contact button also opens a chat before ordering.
- When the company cancels an order, read the note it wrote and, for a paid order, see whether and when the money was returned.
- Rate a completed order or service request (1 to 5 stars, quick tags and a comment), and change the rating for 7 days.
- Get in-app and push notifications, and choose the language and the appearance in Settings.

### Company admin (app or company panel)

- Signs in with the account Platform Admin created, and sets their own password on first sign-in.
- Sees the company's numbers, and orders by status.
- Confirms payments after checking the receipt (confirming takes the order's stock), moves paid orders through processing, out for delivery and completed, and assigns installation jobs to technicians.
- Cancels an order while it is Processing, before or after confirming its payment, or as out of stock when the product can no longer cover an order whose payment is not confirmed, with an optional note for the customer. Any money the customer transferred is returned by the company outside the app, and the company records the day it did.
- Accepts, rejects and progresses service requests.
- Manages the catalogue: products with stock and prices, services with the company's own prices, and offers (a percentage or a new price, a duration and a badge).
- Adds technicians, keeps the company profile and location, the bank accounts customers pay into (up to 5), the pickup points (up to 5) and the cities it serves.
- Reads customer ratings and replies to them.
- Chats with customers and gets notifications for new orders and ratings.

### The company panel (`company_web`)

The panel does everything above on a computer, and is built to avoid the mistakes the first apps made:

- **Safe edits.** Saving a product writes only the fields that changed, and a stock change is a transaction on the number stored at that moment, so a payment confirmed while a form was open is never overwritten.
- **Products.** A table with the price and the stock editable in place, status tabs (published, draft, archived, hidden by the platform), cards for what needs attention (low stock, no picture, price on request, on offer), bulk actions, a CSV download of the table, and **import from a CSV file**: every row is checked first, and the products arrive as drafts. A product with open orders cannot be deleted, only archived.
- **Orders.** The receipt can be zoomed and rotated, confirming shows what it does to the stock and warns when the stock cannot cover the pending orders (oldest first), rejecting a receipt sends a reason to the customer in the order chat, and several waiting orders can be cancelled as out of stock at once.
- **Today.** Receipts waiting (with the time left), orders to ship, installations without a technician, refunds to record, low stock and the confirmed sales of the week.
- **Pictures** are added from a link for now (see [Working on the Firebase free plan](#working-on-the-firebase-free-plan)); a location is chosen on a map.
- **Chats, notifications, reviews** have their own pages with unread badges. Dark mode follows the device, and there is an English version (switch in the top bar).

### Technician

- Signs in with the login their company created.
- Sees the installation jobs assigned to them and updates their status once the company has confirmed the payment.
- Gets notifications for new jobs.

### Platform Admin (web)

- Adds companies together with their company-admin login, and approves, rejects, activates or deactivates them. Deleting a company removes its data but keeps its orders.
- Keeps each company's registration number and document (visible to Platform Admin only).
- Manages customers, the category tree and the service catalogue.
- Views products, orders, service requests and analytics.
- Hides abusive reviews (they leave the averages) or shows them again.

## Orders, payment and stock

The customer pays by bank transfer outside the app. A product is not reserved when the order is placed: its stock is taken only when the company confirms the payment. The security rules in `firestore.rules` enforce this model; the apps' own checks only make it clearer.

```
Customer: Create Order
  -> receipt required (written in the same transaction as the order)
  -> email_verified required
  -> stockReserved = false
  -> no stock deduction (the product is not written)

Company: Confirm Payment
  -> one atomic write (transaction) of the order and its product
  -> stock deduction (exactly the order's quantity)
  -> paymentStatus = confirmed
  -> stockReserved = true

Then: Processing -> Out for Delivery -> Completed
      (a pickup order goes from Processing straight to Completed)
```

- **A receipt is not a confirmed payment.** It is only the customer's claim that they paid. The payment stays `pending_verification` until the company checks that the money arrived and confirms it. Only the order's own company can confirm, and only when the receipt is stored.
- **Stock is not reserved when the order is placed.** At that moment the product only has to be available with enough stock, and nothing is taken. The stock is taken when the company confirms the payment, in the same write as the confirmation. If the product cannot cover the order at that point, nothing is written and the order stays waiting.
- **Nothing ships before the payment is confirmed.** Neither the company nor the technician can move the order to Out for Delivery or Completed while its payment is waiting.
- **Only published products can be ordered.** A product has a status set by its company: `published`, `draft` or `archived` (a document without one is published). Customers neither see nor order a draft or an archived product, and the rules refuse an order for one.
- **Out of stock.** If the product can no longer cover an order whose payment is not confirmed (not enough stock, or the product was removed), the company cancels the order with the reason `out_of_stock`. The company returns any money the customer transferred outside the app (manual refund).
- **Cancelling after the payment is confirmed** is allowed to the company while the order is still Processing, before it is shipped. Its stock goes back to the product in the same write (when the product still exists), exactly once (a cancelled order is final). The company returns the money outside the app.
- **Cancel note and refund record.** A company cancelling can add a short note (`cancelNote`, up to 300 characters) that the customer reads. When the company panel cancels, the customer is also sent a notification (`order_cancelled_by_company`) in the same write. After returning the money of a paid cancelled order the company records it once (`refundedAt`), and the customer sees the date.
- **Expired.** If the company has not confirmed the payment within 24 hours, its app or its panel cancels the order with the reason `expired` the next time its Orders page is opened (the panel also checks every 5 minutes while it stays open). The 24 hours are measured by the server's clock. There is no server job for this yet (see the free plan below).
- **Quota.** A customer can place at most 10 orders in any 24 hours. Cancelled orders still count.
- **Verified e-mail.** Placing an order needs a verified e-mail address (`email_verified` in the sign-in token).
- **Older orders.** Orders placed before this change took their stock when they were placed: they have `stockReserved` true, or no `stockReserved` field at all (the rules of that time did not allow it). Only an explicit `stockReserved: false` means "not taken yet"; a missing field is never read that way, and the order date plays no part. Older orders are confirmed without taking more, and a cancellation or an expiry gives that stock back once (when the product still exists).

Receipts themselves are described in [docs/receipts.md](docs/receipts.md).

## How it is built

### Mobile app

- **Flutter** with **Riverpod** for state, in a feature-based, practical clean architecture: each feature in `lib/features/<feature>/` has `data/`, `domain/` and `presentation/` layers, and shared code lives in `lib/core/` (theme, shared widgets, localization, errors).
- **Firebase Authentication** (email and password, Google sign-in) and **Cloud Firestore**, with live listeners so changes show up at once.
- `flutter_map` with OpenStreetMap tiles for locations (no map API key needed), and `geolocator` for the current position.
- **Firebase Cloud Messaging** for push notifications.

### Web apps

`customer_web`, `company_web` and `platform_admin_web` are React 19 and TypeScript apps built with Vite, using the Firebase JavaScript SDK directly, with Vitest for their tests. The two shops (`customer_web`, `company_web`) use Leaflet with OpenStreetMap tiles for maps, load heavy parts only when needed, and refuse to leave a blank screen after a new deploy: the customer site checks `version.json` and reloads, and the company panel shows a message or reloads once.

### Working on the Firebase free plan

The project runs on the Firebase **Spark (free) plan**, which has no Cloud Functions and no Cloud Storage. Some parts are designed around that:

- **Security rules do the server's job.** Every write is checked in `firestore.rules`: who may write, which fields, which status changes, the stock taken when a payment is confirmed (and given back on cancellation), the order quota, and that rating averages stay correct. The apps' own checks are only there for a better experience.
- **Receipts and documents are stored in Firestore** as compressed image bytes, in their own documents that only the right people can read (see [docs/receipts.md](docs/receipts.md)).
- **Pictures are links.** There is no Storage bucket, so a company adds a product or logo picture from a link. Uploading from the device is built in the panel and waits for the project to move to the paid (Blaze) plan, together with the server-side jobs below.
- **No server jobs.** The 24-hour payment expiry runs from the company's app or panel (see above), and stock is not held at order time. Both want Cloud Functions.
- **Rating averages are kept without a server.** The batch that saves a review also updates the running sum and count, and the rules check that the numbers match.
- **Accounts for companies and technicians are created from the browser** with a second, temporary Firebase app, so no Admin SDK is needed.
- **Push notifications go through a relay** (`push_relay/`) on Cloudflare Workers. It only sends notifications and chat messages that are already in Firestore, written by the caller within the last 10 minutes, and each one only once. A notification is worded by the relay from its type; an unknown type is not sent.
- **Public pages are generated, not served live.** The customer website is behind sign-in, so a script writes static catalog pages for search engines (see [Public catalog pages](#public-catalog-pages)).

## Getting started

### Requirements

- Flutter 3.47 or newer (Dart 3.13 or newer) and the Android SDK, with an emulator or a device
- Node.js 20.19 or newer (or 22.12 or newer), for the web apps, the rules tests and the push relay
- Java, for the Firestore emulator used by the rules tests
- The Firebase CLI (`npm install -g firebase-tools`)

### Run the mobile app

```bash
flutter pub get
flutter run
```

The Firebase configuration (`lib/firebase_options.dart` and `android/app/google-services.json`) is committed and points to the `sudan-it-marketplace` project.

Push notifications are off unless the app is given the relay's address:

```bash
flutter run --dart-define=PUSH_RELAY_URL=https://your-relay.workers.dev
```

Build a release APK (always with the relay's address, or pushes are silently off):

```bash
flutter build apk --release --target-platform android-arm,android-arm64 --dart-define=PUSH_RELAY_URL=https://sudan-it-push.<account>.workers.dev
```

### Run the web apps

Each one is run the same way, from its own folder:

```bash
cd customer_web   # or company_web, or platform_admin_web
npm install
npm run dev
```

| App | Address | Who can sign in |
| --- | --- | --- |
| `platform_admin_web` | http://localhost:5173 | an active `platform_admin` account |
| `customer_web` | http://localhost:5190 | customers |
| `company_web` | http://localhost:5195 | company admins (an active `company_admin`) |

By default they talk to the real project. To try things safely, start the emulators with `firebase emulators:start --only auth,firestore --project sudan-it-marketplace` and put `VITE_EMULATOR=1` in a `.env.local` file in `customer_web/` or `company_web/`. **Delete that file (or set it aside) before building for a deploy**: a build that contains it points at the emulators.

### Run the push relay

The relay needs a Firebase service account key. **Never commit that key**; `.gitignore` blocks the usual file name. Setup and deployment steps are at the top of `push_relay/wrangler.toml`. To run it locally:

```bash
cd push_relay
node dev-server.mjs
```

## Tests

| What | Command |
| --- | --- |
| Flutter tests | `flutter test` |
| Flutter static analysis | `flutter analyze` |
| Customer website tests, and its type check | `cd customer_web && npm test` and `npm run typecheck` |
| Company panel tests, and its type check | `cd company_web && npm test` and `npm run typecheck` |
| Web dashboard unit tests | `cd platform_admin_web && npm test` |
| Web dashboard type check and lint | `npm run typecheck` and `npm run lint` |
| Firestore rules tests | `cd platform_admin_web && npm run test:rules` |
| Push relay tests | `cd push_relay && npm test` |

The rules tests start a local Firestore emulator and use fake users only, so they never touch the real project. On Windows the emulator's Java process can outlive the command; if the next run says port 8080 is taken, stop that leftover `java` process. The company panel's test suite also fails when a text has no English translation.

## Deploying

Rules and each web app are deployed separately, and the three Hosting sites are `sudan-it-marketplace` (the admin dashboard), `sudan-it-market` (the customer website) and `sudan-it-company` (the company panel):

```bash
# Firestore security rules
firebase deploy --only firestore:rules --project sudan-it-marketplace

# The Platform Admin dashboard (the default Hosting site)
cd platform_admin_web && npm run build && cd ..
firebase deploy --only hosting --project sudan-it-marketplace

# The customer website
cd customer_web && npm run build && cd ..
firebase deploy --config firebase.customer.json --only hosting --project sudan-it-marketplace

# The company panel
cd company_web && npm run build && cd ..
firebase deploy --config firebase.company.json --only hosting --project sudan-it-marketplace
```

Do not run a bare `firebase deploy`: it also tries to deploy `storage.rules`, which fails because the free plan has no Storage bucket.

After changing `firestore.rules`, run the rules tests before deploying. The apps rely on the deployed rules, so a feature that needs new rules does not work in the live app until they are deployed. Deploy the rules before the sites that use a new field.

### Public catalog pages

Before building the customer website for a deploy, refresh its public pages if the catalog changed. This reads the live data with your Firebase CLI login (run `firebase login` once):

```bash
npm --prefix customer_web run seo
```

It writes `customer_web/public/catalog/`, `sitemap.xml` and `robots.txt` (not committed), and the next build carries them. Only what a customer can buy is shown, and never contact details or payment accounts. The pages are a snapshot of the moment the script ran. When the site gets its own domain, run it with `--site-url https://your-domain` and deploy again. More in [docs/customer-web-plan.md](docs/customer-web-plan.md).

## Localization (English / العربية)

All four apps are fully translated into English (`en`) and Arabic (`ar`). Arabic switches the whole layout to right-to-left.

- **Flutter**: texts live in `lib/l10n/app_en.arb` (template) and `lib/l10n/app_ar.arb`. Use `context.l10n.someKey` in widgets. Keys are camelCase because ARB keys cannot contain dots (`commonCancel` = `common.cancel`). After editing an ARB file run `flutter gen-l10n`; the generated `lib/l10n/app_localizations*.dart` files are committed.
- **Platform Admin**: texts live in `platform_admin_web/src/i18n/dictionary.ts` (`en` and `ar`, checked by TypeScript). Use `useI18n().t('key')`.
- **Customer website and company panel**: the code is written in Arabic and each Arabic text is its own key: `t('نص عربي')`, with `{0}`, `{1}` for values. The English is in `src/i18nEn.ts` (a text missing there stays Arabic). Changing the language reloads the page. In the company panel a test fails if a text has no English.
- **Choosing the language**: on the login/register screens, and in Settings (the gear icon) once signed in; on the company panel with the `EN` / `ع` button in the top bar. The choice applies at once (the web pages reload). It is remembered on the device (Flutter: SharedPreferences key `language`; web: localStorage) and the apps also save it to `users/{uid}.language` (`"en"` or `"ar"`). A language stored on the profile wins at sign-in; users without one keep their device choice (English if none).
- **Not translated on purpose**: data stored in Firebase (company, product, customer and technician names, emails, phone numbers, order ids). Only UI text and system-generated messages are translated. Notifications store no text: only their type and the order's product name, and the words are built from those in the reader's language. Cities and categories carry both names and show the one in the reader's language.
- **Errors**: the data layer throws codes (`AuthException.code`, `AppException`, `StockUnavailableException.issue`); the UI turns them into text in the current language.

## Notifications

Two kinds, both written to Firestore (`notifications`) by the apps when something happens:

| Event | Who is told |
|---|---|
| New order | the company's admins |
| Payment confirmed, out for delivery, completed | the customer |
| The company cancels an order (from the company panel) | the customer |
| Technician assigned | the technician |
| New rating / the company's reply | the company / the customer |
| New service request, or the customer cancels it | the company's admins |
| Service request accepted, declined, started, completed | the customer |
| Chat message (including a Contact question) | the other side of the conversation |

- **In the apps**: every notification except chat messages shows in the Notifications list and opens the order or service request it is about. Chat messages have their own conversation list. Notifications are stored with their type and shown in the reader's language (see Localization). The company panel shows them with unread badges in the top bar.
- **On the phone**: the same events are pushed to the recipients' phones (FCM), even with the app closed, in their language. Tapping one opens the order, request or conversation (a technician's job just opens the app). The company panel also asks the relay to push the notifications it writes.

### How phone pushes work

The Firebase Spark plan has no Cloud Functions, so a small relay (`push_relay/`, a Cloudflare Worker) sends them. Right after an app writes a notification or a chat message it asks the relay to push it. The relay never sends text it was handed: it reads the item back from Firestore and only sends it if the caller is signed in, is the one who wrote it, it is under 10 minutes old and it was not pushed before (`push_log`, closed to the apps by the rules).

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
   Redeploy with `npx wrangler deploy` whenever `push_relay/src/` changes (for example new notification texts, such as the one for a cancelled order).
4. **Build the app with the relay's address** (printed by `wrangler deploy`), as shown in [Run the mobile app](#run-the-mobile-app).
5. **Try it on a phone**: sign in on two devices, place an order or send a service request on one and check the other.

### Tests

- App: `flutter test`
- Relay: `cd push_relay && npm test`
- Security rules (needs the Firebase emulators): `cd platform_admin_web && npm run test:rules`

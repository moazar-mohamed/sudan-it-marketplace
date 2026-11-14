> **Archived.** This folder is the first SICTM site (one HTML file on Netlify) and its PWABuilder Android build, kept for reference. The live marketplace is the project at the root of this repository; see the [main README](../README.md).
>
> **أرشيف.** هذا المجلد هو موقع SICTM الأول (ملف HTML واحد على Netlify) وبناء أندرويد الخاص به، محفوظ للرجوع إليه. السوق الحالي هو المشروع في جذر هذا المستودع.

# Sudan ICT Marketplace — سوق السودان للتقنية والاتصالات

A bilingual (Arabic / English) marketplace where Sudanese ICT companies list products and services, and customers browse, compare, request quotes, and contact companies.

- **Live site:** https://sictm.net  (also https://www.sictm.net → redirects)
- **Backup address:** https://spontaneous-cobbler-864bc3.netlify.app

---

## Folder contents

| Path | What it is |
|---|---|
| `sictmp.html` | **The source code.** The whole site is this one file (HTML + CSS + JavaScript). Edit this one. |
| `deploy/` | **Everything that goes online.** Upload this whole folder to Netlify. |
| `deploy/index.html` | Copy of `sictmp.html` named `index.html`. |
| `deploy/manifest.webmanifest` | Mobile-app settings (name, icon, colours, home-screen shortcuts). |
| `deploy/sw.js` | Service worker: lets the app open offline and install on phones. |
| `deploy/icons/` | App icons (192, 512, maskable 512, Apple 180). |
| `deploy/.well-known/assetlinks.json` (+ `deploy/assetlinks.json`, `_redirects`) | Links the Android app to sictm.net (full-screen, no browser bar). |
| `deploy/_headers` | Correct file types / caching for the app files on Netlify. |
| `deploy/download/SICTM.apk` | Android test app offered for download at **sictm.net/app** (copy of `android/SICTM.apk`). |
| `sictm-site.zip` | The whole `deploy` folder zipped (for Netlify **Drop** only — the project Deploys box does not unpack zips; drag the `deploy` folder there). |
| `android/` | **Android app.** `SICTM.apk` (install on a phone to test), `SICTM.aab` (upload to Google Play), `signing.keystore` + `signing-key-info.txt` (**secret signing key and passwords — never upload or share**). |
| `SICTM - Google Play package.zip` | Original download from PWABuilder (same contents as `android/`). |
| `promo/` | **Promo videos and images** (social media, Google Play, YouTube, link preview). See `promo/README.md`. |
| `deploy/og-image.jpg` | Link-preview image shown when sictm.net is shared on WhatsApp / Facebook / X. |
| `backup/live-sictm.net-2026-11-08.html` | Copy downloaded from the live site on 8 Nov 2026 (identical to `sictmp.html`). |
| `firebase/firestore.rules`, `firebase/storage.rules` | Security rules to paste into the Firebase console. |
| `README.md` | This document. |

---

## Hosting & domain

| Item | Details |
|---|---|
| Host | Netlify (free plan) |
| Netlify team | `sudan-ict` |
| Netlify project | `spontaneous-cobbler-864bc3` |
| Netlify login | Sign in with the Sudan ICT Google account |
| Domain | `sictm.net`, registered through Netlify on 8 Nov 2026 |
| Domain cost | $14.99 first year, auto-renews at **$17.99/year** (non-refundable) |
| DNS | Netlify DNS (managed automatically) |
| HTTPS | Free Let's Encrypt certificate, auto-renews (current one before 6 Feb 2027) |

Manage everything at **app.netlify.com → spontaneous-cobbler-864bc3 → Domain management**.

> Keep the card on the Netlify account valid, or the domain will not renew and the site will go offline at sictm.net.

---

## How to update the live site

1. Edit `sictmp.html`.
2. Open it in a browser and check it works.
3. Copy it over `deploy/index.html` (keep the name `index.html`).
4. Go to **app.netlify.com → spontaneous-cobbler-864bc3 → Deploys**.
5. Drag the `deploy` folder (or a new zip of it) onto the "Drag and drop" area.
6. Wait ~10 seconds, then open https://sictm.net and refresh.

If something breaks, in **Deploys** click an older deploy → **Publish deploy** to roll back instantly.

PowerShell shortcut for step 3 (and re-zipping):

```powershell
Copy-Item E:\SICTM\sictmp.html E:\SICTM\deploy\index.html -Force
Compress-Archive -Path E:\SICTM\deploy\* -DestinationPath E:\SICTM\sictm-site.zip -Force
```

Always upload the **`deploy` folder** — not just `index.html` (the app files would be lost), and **never the whole `E:\SICTM` folder** (that would take the homepage offline and publish the README, rules, and the Android signing key for anyone to download).

---

## Mobile app

The website is also an installable mobile app (a "PWA"). The app **is** the website: same code, same data, same accounts. Every Netlify redeploy updates the app automatically on every phone — no separate app to maintain.

**Install on Android (Chrome):** open https://sictm.net → tap the **📲 App** button in the header (or Chrome menu ⋮ → *Install app*).
**Install on iPhone (Safari):** open https://sictm.net → Share button → **Add to Home Screen**.
**Install on Windows / Mac (Chrome or Edge):** click the install icon in the address bar.

Long-press the app icon for shortcuts: **Products**, **Services**, **Companies**.

### Android app (built 8 Nov 2026 with PWABuilder)

| Item | Value |
|---|---|
| Package ID | `net.sictm.twa` (permanent once on Google Play) |
| App / launcher name | SICTM |
| Version | 1.0.0.0 (version code 1) |
| Opens | `https://sictm.net/?source=app` |
| Files | `android/SICTM.apk`, `android/SICTM.aab` |
| Signing key | `android/signing.keystore`, passwords in `android/signing-key-info.txt` |
| Upload-key SHA-256 | `C4:CC:FB:CC:AF:19:C9:0B:AE:86:27:8D:1B:7E:EA:25:42:84:B9:EF:B3:F8:2B:81:56:B9:51:21:D0:6C:FB:D8` |

> **Back up `signing.keystore` and `signing-key-info.txt`** to a USB drive / Google Drive (private). If they are lost you can never update the Play Store app — you'd have to publish a new app. Never put them in `deploy/` or share them.

**Download link for testers:** **https://sictm.net/app** (also `sictm.net/android`, and "📱 Android app" in the site footer — hidden when already inside the app). Open it on an Android phone, tap the downloaded file, allow installing from this source. If you rebuild the app, copy the new `android/SICTM.apk` over `deploy/download/SICTM.apk` and redeploy. Once the app is on Google Play, replace the link with the Play Store link.

**Test on a phone:** copy `SICTM.apk` to an Android phone (USB, WhatsApp to yourself, Google Drive), tap it, allow "install unknown apps". It should open sictm.net full-screen with no address bar (only once `assetlinks.json` is live — before that, a small browser bar shows at the top).

**Publish on Google Play:**
1. Create a Google Play developer account (one-time **$25**) at https://play.google.com/console. New personal accounts must run a closed test with at least 12 testers for 14 days before going public.
2. **Create app** → name "Sudan ICT Marketplace", app, free.
3. Fill in the store listing (description, screenshots `promo/play-screenshot-1…5.png`, feature graphic `promo/play-feature-graphic-1024x500.png`, the 512 px icon from `deploy/icons/icon-512.png`, privacy policy URL **`https://sictm.net/privacy`**; account-deletion URL also `https://sictm.net/privacy` (section 8), contact email `sudanict2@gmail.com`), content rating and data-safety forms.
4. **Release → Testing/Production → Create release** → upload `android/SICTM.aab`.
5. After upload, open **Setup → App integrity → App signing**, copy the **App signing key SHA-256**, and add it as a second fingerprint in `deploy/.well-known/assetlinks.json` and `deploy/assetlinks.json` (inside the `sha256_cert_fingerprints` list), then redeploy. Without this, the Play Store version shows a browser bar.
6. Website updates reach the app automatically. Only rebuild in PWABuilder (with the **same** signing key — choose "Use mine" and upload `signing.keystore`, raise the version code) if you change the app name, icon, colours or package.

Apple App Store needs a Mac and a $99/year Apple developer account; iPhone users can use *Add to Home Screen* instead.

---

## ⚠️ Demo mode — important before real use

The site currently runs in **local demo mode**. In `sictmp.html` the Firebase setting still says:

```js
const FIREBASE_CONFIG={apiKey:"PASTE_API_KEY", ... projectId:"sudan-it-marketplace", ...}
```

While `apiKey` contains `PASTE`, every visitor's accounts, products, orders and reviews are stored **only in their own browser**. Companies cannot see customers' orders, and nothing is shared.

To make it a real shared marketplace:

1. Go to https://console.firebase.google.com and open (or create) the project `sudan-it-marketplace`.
2. Enable **Authentication** (Phone and/or Email), **Firestore Database**, and **Storage**.
3. Project settings → Your apps → Web app → copy the config values.
4. Paste them into `FIREBASE_CONFIG` in `sictmp.html` (replacing `PASTE_API_KEY` etc.).
5. In Firebase Authentication → Settings → **Authorized domains**, add `sictm.net` and `www.sictm.net`.
6. Set security rules before going public: paste `firebase/firestore.rules` into Firestore → Rules, and `firebase/storage.rules` into Storage → Rules, then Publish.
7. To make yourself admin: sign in on the site once, copy your UID from Authentication → Users, then in Firestore create collection `admins` with a document whose ID is that UID (any field, e.g. `name`).
8. Redeploy (see "How to update").

---

## Features

**Customers**
- Search with live suggestions; quick-search chips (only show terms that have results)
- Separate **Products** and **Services** pages, plus category / sub-category, city, price and rating filters; grid or list view
- Product details, favourites, compare, cart and checkout
- **Request a quote** (in-site) and **Ask price on WhatsApp** (opens WhatsApp with a pre-written message to the company)
- Rate products and companies
- Arabic / English toggle, light / dark theme, mobile friendly

**Companies**
- Register, edit profile (name, city, phone, **WhatsApp number**, about, registration certificate)
- Add / edit products and services, with up to 4 photos each
- Receive quote requests and orders

**Company dashboard** (tabs)
- Overview: products / services count, orders, new orders, quote requests, sales total, rating, items hidden by admin, top listings, recent activity
- My listings: products and services in separate tables with sold count, quotes, rating and status; add / edit / delete
- Orders (change status), Quotes, Activity log (search, filter, CSV export), Company profile

**Admin dashboard** (tabs)
- Overview: site totals, "needs attention" (companies waiting for approval, new orders), most active companies, recent activity
- Companies: approve / suspend, edit details, view their listings or activity, delete (with their listings)
- Listings: every product and service, filter by type / company / status; add for any company, edit, hide / show, delete
- Orders (change status, delete), Quotes, Reviews (delete)
- Users: filter by role / status; suspend / reactivate (suspended users can't sign in), make / remove admin, delete
- Admins: **create admin user** by email or mobile number, list and remove admins
- Activity log of everything done on the site (sign-ups, sign-ins, listings, orders, status changes, quotes, reviews, approvals, admin actions) with filters and CSV export

### Admin accounts
- **Demo mode:** sign in with `admin@sictmp.com` (email) — that account is admin. From **Admin → Admins** you can create more admin users; they sign in with the email / number you enter.
- **Firebase mode:** add the first admin by hand (see step 7 above). After that, use **Admin → Admins**: an existing user is promoted immediately; a new email / number gets an invite and becomes admin on first sign-in. Republish `firebase/firestore.rules` (updated 8 Nov 2026) or these features will be refused.

---

## Change log

**8 Nov 2026 (product photos)**
- Companies (and admins) can add **up to 4 photos** per product/service when adding or editing: pick several at once from the gallery or camera, remove (✕), choose the cover (★). Photos are shrunk on the phone before saving (demo ≈ 50–100 KB each at 800 px; Firebase ≈ 100–300 KB at 1200 px).
- Cover photo shows on product cards (with a 📷 count), a gallery with thumbnails in the product window, and a thumbnail in the dashboard listings tables.
- Demo mode: if the device's storage is full, the product is not saved, the form stays open with the photos, and a clear message is shown (previously storage errors were silent).
- Firebase mode: photos go to Storage at `products/{companyUid}/{productId}/…`; removed/deleted photos are cleaned up. **Republish `firebase/storage.rules`** (updated with the `products/` rule) or uploads will be refused.

**8 Nov 2026 (company onboarding)**
- New companies now see a clear "under review" box: their listings are saved but hidden until admin approval, with a checklist (profile, certificate, approval) and a "Complete company profile" button. In demo mode it also says data stays on this device.
- After adding a product, the message says whether it is live or waiting for approval.
- How to approve a company: sign in as admin → Admin dashboard → Companies → **اعتماد / Approve**. (Demo mode: admin is `admin@sictmp.com` by email, on the same device where the company registered.)

**8 Nov 2026 (promo)**
- Promo videos (vertical 1080×1920 and landscape 1920×1080, 24 s MP4) and images (link preview, Play feature graphic, 5 Play screenshots, square, story, YouTube thumbnail) in `promo/`.
- Site now has link-preview tags (Open Graph / Twitter) and a meta description; preview image `deploy/og-image.jpg`.

**8 Nov 2026 (Android download)**
- Android test app downloadable at `sictm.net/app` / `sictm.net/android`; "📱 Android app" link in the footer.
- Service worker v2: downloads are never cached, and only real pages are saved as the offline copy.

**8 Nov 2026 (privacy policy)**
- New bilingual **Privacy Policy** page (data collected, use, sharing incl. Firebase/Netlify/Google Fonts/WhatsApp, mobile app, storage, retention, rights & account deletion, children). Linked from the footer and the sign-up form.
- Pages now have their own addresses: `sictm.net/privacy`, `/terms`, `/products`, `/services`, `/companies` (via `deploy/_redirects`).
- Contact email on Privacy and Terms changed to `sudanict2@gmail.com` (was `admin@sictmp.com`, not a domain we own). Footer now says sictm.net.
- To edit the policy: `PRIVACY` and `PRIVACY_DATE` in `sictmp.html` (update the date when you change it). Contact email: `SITE_EMAIL`.

**8 Nov 2026 (Android app)**
- Built the Android app with PWABuilder (`android/`): package `net.sictm.twa`, APK for testing, AAB for Google Play, signing key.
- Added `assetlinks.json`, `_headers` and `_redirects` to `deploy/` to link the app to sictm.net.

**8 Nov 2026 (mobile app)**
- Site is now an installable mobile app: app manifest, icons, service worker (works offline with the last saved copy), **📲 App** install button, home-screen shortcuts (`/?go=products`, `/?go=services`, `/?go=companies`).
- `deploy/` now has several files — upload the whole folder.

**8 Nov 2026 (admin update)**
- New tabbed Admin dashboard with full control of companies, listings, orders, quotes, reviews, users and admins; create admin users from the site.
- New tabbed Company dashboard with activity overview, products and services lists, editing, and its own activity log.
- Activity log (new `activity` collection), user suspension, admin hiding of listings. Firestore rules updated — republish them.

**8 Nov 2026**
- Homepage search chips now only show terms that return results.
- Added "Ask price on WhatsApp" button in the product window; companies can set a separate WhatsApp number (falls back to phone). Local numbers like `0912…` are converted to `249912…`.
- Split "Products & Services" into separate **Products** and **Services** menu pages and homepage sections.
- Published on Netlify; registered and connected **sictm.net** with HTTPS.
75.2.60.5 website ip
